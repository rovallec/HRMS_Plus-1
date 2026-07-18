import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SandboxService {
  private readonly url = 'https://my.cxperts.us/api/endpoints/sandbox.php';
  //private readonly url = 'http://localhost/endpoints/sandbox.php';


  constructor(private http: HttpClient) {}

  requestAccess(email: string): Observable<any> {
    return this.http.post(this.url, { action: 'request', email });
  }

  access(token: string): Observable<any> {
    return this.http.post(this.url, { action: 'access', token });
  }

  resume(sessionToken: string, client: string): Observable<any> {
    return this.http.post(this.url, { action: 'resume', sessionToken, client });
  }

  saveFeedback(sessionToken: string, feedback: string): Observable<any> {
    return this.http.post(this.url, { action: 'feedback', sessionToken, feedback });
  }
}
