import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { Code } from '../models/code';

@Injectable({ providedIn: 'root' })
export class AppeasementService {
  //private readonly API_URL = 'https://my.cxperts.us/api/endpoints';
  private readonly API_URL = 'http://localhost/endpoints';
  private readonly GRAPH_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value';

  
  // 👉 ideal: mover esto a environment.ts
  private API_SECRET = 'rroFg1TWJ1%xNS';

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


  // =========================================================
// BIMI LIVE DASHBOARD
// =========================================================

getBimiDashboard(
  brand: string,
  range: string,
  timezone: string
): Observable<any> {

  return this.http.post<any>(

    `${this.API_URL}/getBimiDashboard.php`,

    {

      brand,

      range,

      timezone

    }

  ).pipe(

    map(res => {

      if (!res.success) {

        throw new Error(
          'BIMI dashboard error'
        );

      }

      return res;

    }),

    catchError(err => {

      console.error(
        'BIMI dashboard API error',
        err
      );

      return of({

        success: true,

        tickets: []

      });

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

// =========================================================
// MARC JACOBS OMS
// =========================================================

lookupMjOrder(orderNumber: string): Observable<any> {

  return this.http.post<any>(

    `${this.API_URL}/getOrderMJMM.php`,

    {
      orderNumber
    }

  );

}

// =========================================================
// ColeHaan OMS
// =========================================================

lookupCOLUSOrder(orderNumber: string, email:string, postalCode:string, zip:string): Observable<any> {

  return this.http.post<any>(

    `${this.API_URL}/getOrderCOLUS.php`,

    {
      orderNumber,
      email,
      postalCode,
      zip
    }

  );

}

// ===============================
// OMS Management
// ===============================
getCustomers(): Observable<any> {

  return this.http.get<any>(
    `${this.API_URL}/getCustomers.php`
  );

}

getOrders(idCustomer: number): Observable<any> {
  return this.http.get<any>(
    `${this.API_URL}/getOrders.php?id_customer=${idCustomer}`
  );
}

getTrackings(idOrder: number): Observable<any> {
  return this.http.get<any>(
    `${this.API_URL}/getTrackings.php?id_order=${idOrder}`
  );
}

saveResult(payload: any): Observable<any> {
  return this.http.post<any>(
    `${this.API_URL}/saveResult.php`,
    payload
  );
}

getTrackingByToken(token: string): Observable<any> {

  return this.http.post<any>(
    `${this.API_URL}/getTrackingByToken.php`,
    { token }
  );

}
// ===============================
// PROPERTY MANAGEMENT (SECURE FINAL)
// ===============================
getKimcoPropertyManagement(payload: {
  buildingId: string,
  tenantId?: string
}) {

  return new Observable<any>(observer => {

    (async () => {

      try {

        const body = {
          buildingId: payload.buildingId,
          tenantId: payload.tenantId ?? null,
          timestamp: Date.now()
        };

        const signature = await this.generateSignature(body);

        const headers = {
          'Content-Type': 'application/json',
          'X-SIGNATURE': signature
        };

        this.http.post(
          `${this.API_URL}/getKimcoPropertyManagement.php`,
          body,
          { headers }
        ).subscribe({
          next: res => {
            observer.next(res);
            observer.complete();
          },
          error: err => observer.error(err)
        });

      } catch (e) {
        observer.error(e);
      }

    })();

  });

}

private async generateSignature(payload: any): Promise<string> {

  const secret = this.API_SECRET;
  const encoder = new TextEncoder();

  const canonicalString =
    `buildingId=${payload.buildingId ?? ''}&` +
    `tenantId=${payload.tenantId ?? ''}&` +
    `timestamp=${payload.timestamp ?? ''}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(canonicalString)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

private buildCanonicalPayload(payload: {
  buildingId: string;
  tenantId?: string;
}) {

  return {
    buildingId: payload.buildingId,
    tenantId: payload.tenantId ?? null,
    timestamp: Date.now()
  };
}
}
