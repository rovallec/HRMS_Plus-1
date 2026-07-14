import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaForm, TaSubmission } from '../ta/ta.models';

@Injectable({ providedIn: 'root' })
export class TaService {
  // Keep TA on the same API base currently used by the rest of the application.
  private readonly url = 'https://my.cxperts.us/api/endpoints';
  //private readonly url = 'http://localhost/endpoints/ta.php';

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return new HttpHeaders({
      'X-TA-User': String(user.idusers || user.idUser || user.id || ''),
      'X-TA-Username': String(user.username || '')
    });
  }

  listForms(): Observable<{ data: TaForm[] }> {
    return this.http.get<{ data: TaForm[] }>(this.url, { headers: this.headers() });
  }

  getForm(slug: string): Observable<{ data: TaForm; attemptsUsed: number }> {
    return this.http.get<{ data: TaForm; attemptsUsed: number }>(`${this.url}?slug=${encodeURIComponent(slug)}`, { headers: this.headers() });
  }

  saveForm(form: TaForm): Observable<{ data: TaForm }> {
    return this.http.post<{ data: TaForm }>(this.url, { action: 'saveForm', form }, { headers: this.headers() });
  }

  deleteForm(id: number): Observable<unknown> {
    return this.http.delete(`${this.url}?id=${id}`, { headers: this.headers() });
  }

  listSubmissions(formId?: number): Observable<{ data: TaSubmission[] }> {
    const query = formId ? `?submissions=1&formId=${formId}` : '?submissions=1';
    return this.http.get<{ data: TaSubmission[] }>(this.url + query, { headers: this.headers() });
  }

  submit(formId: number, answers: Record<string, unknown>, files: Record<string, File>, startedAt: string, displayedFieldIds: string[], location?: GeolocationCoordinates, countryCode?: string): Observable<unknown> {
    const body = new FormData();
    body.append('action', 'submit');
    body.append('formId', String(formId));
    body.append('answers', JSON.stringify(answers));
    body.append('startedAt', startedAt);
    body.append('displayedFieldIds', JSON.stringify(displayedFieldIds));
    if (location) body.append('location', JSON.stringify({ latitude: location.latitude, longitude: location.longitude, countryCode }));
    Object.entries(files).forEach(([key, file]) => body.append(`file_${key}`, file));
    return this.http.post(this.url, body, { headers: this.headers() });
  }
}
