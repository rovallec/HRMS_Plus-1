import { AfterViewInit, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SandboxService } from '../services/sandbox.service';

@Component({
  selector: 'app-sandbox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sandbox.html',
  styleUrl: './sandbox.css'
})
export class Sandbox implements OnInit, AfterViewInit, OnDestroy {
  email = '';
  feedback = '';
  sessionToken = '';
  activeClient = '';
  authorizedClients: string[] = [];
  loading = false;
  authorized = false;
  requestSent = false;
  feedbackSaved = false;
  error = '';
  hasAccessToken = false;
  private widgetKey = '';

  constructor(private route: ActivatedRoute, private api: SandboxService) {}

  ngOnInit(): void {
    // Query-string tokens are preferred for production deep links; retain the
    // path parameter for links already issued before this change.
    const token = this.route.snapshot.queryParamMap.get('token')
      || this.route.snapshot.paramMap.get('token');
    this.hasAccessToken = !!token;
    if (token) this.exchangeToken(token);
  }

  ngAfterViewInit(): void {
    if (this.authorized) this.loadWidget();
  }

  requestAccess(): void {
    if (this.loading || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
      this.error = 'Please enter a valid email address.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.api.requestAccess(this.email.trim()).subscribe({
      next: () => { this.loading = false; this.requestSent = true; },
      error: () => { this.loading = false; this.error = 'The sandbox service is temporarily unavailable.'; }
    });
  }

  saveFeedback(): void {
    if (!this.feedback.trim() || this.loading) return;
    this.loading = true;
    this.error = '';
    this.api.saveFeedback(this.sessionToken, this.feedback.trim()).subscribe({
      next: () => { this.loading = false; this.feedbackSaved = true; },
      error: (err) => { this.loading = false; this.error = err.error?.error || 'Feedback could not be saved.'; }
    });
  }

  private exchangeToken(token: string): void {
    this.loading = true;
    this.api.access(token).subscribe({
      next: (res) => {
        this.loading = false;
        this.authorized = true;
        this.activeClient = res.client;
        this.authorizedClients = Array.isArray(res.clients) && res.clients.length
          ? res.clients
          : [res.client];
        this.sessionToken = res.sessionToken;
        this.setWidgetKey(this.activeClient);
        setTimeout(() => this.loadWidget());
      },
      error: (err) => { this.loading = false; this.error = err.error?.error || 'Invalid or already used access link.'; }
    });
  }

  switchClient(client: string): void {
    if (!this.authorizedClients.includes(client) || client === this.activeClient) return;
    this.removeWidget();
    this.activeClient = client;
    this.setWidgetKey(client);
    setTimeout(() => this.loadWidget());
  }

  clientLabel(client: string): string {
    return client === 'MarcJacobs' ? 'Marc Jacobs' : 'Cole Haan';
  }

  private setWidgetKey(client: string): void {
    this.widgetKey = client === 'MarcJacobs'
      ? 'c71de9c3-3113-4643-aa00-61f4674ecb1d'
      : 'ad7b3975-31a2-4995-a60b-1fd9869c9163';
  }

  private loadWidget(): void {
    if (!this.widgetKey || document.getElementById('ze-snippet')) return;
    const script = document.createElement('script');
    script.id = 'ze-snippet';
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${this.widgetKey}`;
    script.async = true;
    document.body.appendChild(script);
  }

  ngOnDestroy(): void {
    this.removeWidget();
  }

  private removeWidget(): void {
    const zendesk = (window as any).zE;
    if (typeof zendesk === 'function') {
      try { zendesk('messenger', 'close'); } catch { /* widget may not be ready */ }
    }
    document.getElementById('ze-snippet')?.remove();
    document.querySelectorAll(
      'iframe[title*="messaging" i], iframe[title*="chat" i], #webWidget, [data-garden-id="chrome.container"]'
    ).forEach(element => element.remove());
    delete (window as any).zE;
    delete (window as any).zESettings;
  }
}
