import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { Code } from '../models/code';

@Injectable({ providedIn: 'root' })
export class AppeasementService {
  private readonly API_URL = 'https://my.cxperts.us/api/endpoints';
  //private readonly API_URL = 'http://localhost/endpoints';
  private readonly GRAPH_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value';

  constructor(private http: HttpClient) {}

  /** ===============================
   *  🔹 Codes Methods
   *  =============================== */
  getCodes(brandId: string, roleId: number): Observable<Code[]> {
    return this.http
      .get<any>(`${this.API_URL}/codes.php?brandId=${brandId}&roleId=${roleId}`)
      .pipe(map((res) => (res.status === 'ok' ? res.data : [])));
  }

  addAssignedCode(payload: any): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/assignedcodes.php`, payload);
  }

  /** ===============================
   *  🔹 Authentication Methods
   *  =============================== */

  checkUser(username: string): Observable<any> {
    const payload = { username };
    return this.http.post<any>(`${this.API_URL}/login.php`, payload);
  }

  loginUser(username: string, password: string): Observable<any> {
    const payload = { username, password };
    return this.http.post<any>(`${this.API_URL}/login.php`, payload);
  }

  login(payload: any) {
    return this.http.post<any>(`${this.API_URL}/login.php`, payload);
  }

  logout(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('profile_photo_url');
    window.location.href = '/login';
  }

  /** ===============================
   *  🔹 Microsoft Graph Profile Photo
   *  =============================== */
  getMicrosoftProfilePhoto(): Observable<string | null> {
    const token = localStorage.getItem('access_token');
    if (!token) return of(null);

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'image/jpeg'
    });

    return this.http
      .get(this.GRAPH_URL, { headers, responseType: 'blob' })
      .pipe(
        map((blob) => URL.createObjectURL(blob)),
        catchError(() => of(null))
      );
  }

  /** ===============================
 *  🔹 BIMI Metrics
 *  =============================== */

getBimiMetrics(): Observable<any[]> {

  return this.http
    .get<any>(`${this.API_URL}/getMetricSnapshotsBIMI.php`)
    .pipe(

      map(res => {

        if (!res.success) {
          throw new Error('BIMI metrics not found');
        }

        return res.data || [];

      }),

      catchError(err => {

        console.error('BIMI API error', err);

        return of([]);

      })

    );

}

// =========================================================
// LIVE ZENDESK TICKETS
// =========================================================

getLiveZendeskTickets(payload: any): Observable<any> {

  return this.http.post<any>(
    `${this.API_URL}/liveTickets.php`,
    payload
  );
}

// =========================================================
// KIMCO CASES DASHBOARD
// =========================================================

getKimcoCasesDashboard(): Observable<any> {

  return this.http
    .get<any>(
      `${this.API_URL}/getKimcoCases.php`
    )
    .pipe(

      map(res => {

        if (!res.success) {
          throw new Error(
            'KIMCO dashboard error'
          );
        }

        return res;

      }),

      catchError(err => {

        console.error(
          'KIMCO dashboard API error',
          err
        );

        return of({

          metrics: {
            total: 0,
            success: 0,
            failed: 0,
            successRate: 0
          },

          timeline: [],

          cases: []

        });

      })

    );

}
}
