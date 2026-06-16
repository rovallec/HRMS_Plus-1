import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-open-wa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './open-wa.html',
  styleUrl: './open-wa.css'
})
export class OpenWA {

  apiKey = 'owa_k1_19db831a42174842fdfa52e0039792e1a665b2698b2166a5f32d1b011ff971d2';
  baseUrl = 'http://10.194.77.190:2785';

  sessionId: string | null = null;
  qrImage: string | null = null;
  status = 'idle';
  logs: string[] = [];
  session = `angular-${Date.now()}`;

  // CHAT FIELDS
  phoneNumber: string = '';
  message: string = '';

  constructor(private http: HttpClient) {}

  log(msg: string) {
    this.logs.push(`[${new Date().toISOString()}] ${msg}`);
  }

  createSession() {
    this.status = 'creating';

    this.http.post<any>(
      `${this.baseUrl}/api/sessions`,
      { name: this.session },
      { headers: { 'x-api-key': this.apiKey } }
    ).subscribe(res => {
      this.sessionId = res.id;
      this.status = 'created';
      this.log(`Session created: ${this.sessionId}`);
    });
  }

  startSession() {
    if (!this.sessionId) return;

    this.http.post(
      `${this.baseUrl}/api/sessions/${this.sessionId}/start`,
      {},
      { headers: { 'x-api-key': this.apiKey } }
    ).subscribe(() => {
      this.status = 'started';
      this.log('Session started');
      this.pollQR();
    });
  }

  pollQR() {
    if (!this.sessionId) return;

    const interval = setInterval(() => {

      this.http.get<any>(
        `${this.baseUrl}/api/sessions/${this.sessionId}/qr`,
        { headers: { 'x-api-key': this.apiKey } }
      ).subscribe({
        next: (res) => {
          if (res?.qrCode) {
            this.qrImage = res.qrCode;
            this.status = 'qr_ready';
            this.log('QR received');
            clearInterval(interval);
          }
        },
        error: () => {}
      });

    }, 2000);
  }

  sendMessage() {
  if (!this.sessionId || !this.phoneNumber || !this.message) {
    this.log('Missing phone or message');
    return;
  }

  const payload = {
    chatId: `${this.phoneNumber}@c.us`,
    text: this.message
  };

  this.http.post(
    `${this.baseUrl}/api/sessions/${this.sessionId}/messages/send-text`,
    payload,
    {
      headers: { 'x-api-key': this.apiKey }
    }
  ).subscribe({
    next: (res) => {
      this.log(`Message sent to ${this.phoneNumber}`);
      this.log(JSON.stringify(res));
      this.message = '';
    },
    error: (err) => {
      this.log(`ERROR sending message`);
      this.log(JSON.stringify(err.error || err));
    }
  });
}

  reset() {
    this.sessionId = null;
    this.qrImage = null;
    this.status = 'idle';
    this.logs = [];
    this.phoneNumber = '';
    this.message = '';
  }
}