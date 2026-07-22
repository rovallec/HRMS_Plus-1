import { AfterViewInit, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
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
  displayMode: 'float' | 'stick' = 'float';
  isWidgetOpen = false;
  loading = false;
  authorized = false;
  requestSent = false;
  feedbackSaved = false;
  error = '';
  hasAccessToken = false;
  private widgetKey = '';

  constructor(private route: ActivatedRoute, private api: SandboxService, private zone: NgZone) {}

  ngOnInit(): void {
    // Query-string tokens are preferred for production deep links; retain the
    // path parameter for links already issued before this change.
    const token = this.route.snapshot.queryParamMap.get('token')
      || this.route.snapshot.paramMap.get('token');
    this.hasAccessToken = !!token;
    if (token) {
      this.exchangeToken(token);
      return;
    }

    const savedSession = sessionStorage.getItem('sandboxSessionToken');
    const requestedClient = this.route.snapshot.queryParamMap.get('client')
      || sessionStorage.getItem('sandboxActiveClient');
    const requestedMode = this.route.snapshot.queryParamMap.get('mode')
      || sessionStorage.getItem('sandboxDisplayMode');
    this.displayMode = requestedMode === 'stick' ? 'stick' : 'float';
    if (savedSession && requestedClient) {
      this.resumeSession(savedSession, requestedClient);
    }
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
        sessionStorage.setItem('sandboxSessionToken', this.sessionToken);
        sessionStorage.setItem('sandboxActiveClient', this.activeClient);
        sessionStorage.setItem('sandboxDisplayMode', this.displayMode);
        window.history.replaceState({}, '', this.sandboxUrl(this.activeClient, this.displayMode));
        this.setWidgetKey(this.activeClient);
        setTimeout(() => this.loadWidget());
      },
      error: (err) => { this.loading = false; this.error = err.error?.error || 'Invalid or already used access link.'; }
    });
  }

  switchClient(client: string): void {
    if (!this.authorizedClients.includes(client) || client === this.activeClient) return;
    sessionStorage.setItem('sandboxActiveClient', client);
    // A hard reload gives each Zendesk snippet a completely clean global
    // environment. The consumed access token is not reused; resume validates
    // the already-issued sandbox session instead.
    window.location.href = this.sandboxUrl(client, this.displayMode);
  }

  switchDisplayMode(mode: 'float' | 'stick'): void {
    if (!this.authorized || mode === this.displayMode) return;
    sessionStorage.setItem('sandboxDisplayMode', mode);
    window.location.href = this.sandboxUrl(this.activeClient, mode);
  }

  private resumeSession(sessionToken: string, client: string): void {
    this.loading = true;
    this.api.resume(sessionToken, client).subscribe({
      next: (res) => {
        this.loading = false;
        this.authorized = true;
        this.activeClient = res.client;
        this.authorizedClients = res.clients || [res.client];
        this.sessionToken = sessionToken;
        sessionStorage.setItem('sandboxDisplayMode', this.displayMode);
        this.setWidgetKey(this.activeClient);
        setTimeout(() => this.loadWidget());
      },
      error: (err) => {
        this.loading = false;
        sessionStorage.removeItem('sandboxSessionToken');
        sessionStorage.removeItem('sandboxActiveClient');
        this.error = err.error?.error || 'Your sandbox session is no longer valid.';
      }
    });
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
    script.addEventListener('load', () => {
      if (this.displayMode === 'stick') {
        setTimeout(() => this.configureStickyLauncher(), 250);
      }
    });
    document.body.appendChild(script);
  }

  openStickyWidget(): void {
    const zendesk = (window as any).zE;
    if (typeof zendesk !== 'function') return;
    this.isWidgetOpen = true;
    document.body.classList.add('zendesk-stick-open');
    zendesk('messenger', 'show');
    zendesk('messenger', 'open');
  }

  private configureStickyLauncher(): void {
    const zendesk = (window as any).zE;
    if (typeof zendesk !== 'function') return;
    this.installStickyWidgetStyles();
    zendesk('messenger', 'hide');
    try {
      zendesk('messenger:on', 'open', () => this.zone.run(() => {
        this.isWidgetOpen = true;
        document.body.classList.add('zendesk-stick-open');
      }));
      zendesk('messenger:on', 'close', () => this.zone.run(() => {
        this.isWidgetOpen = false;
        document.body.classList.remove('zendesk-stick-open');
        zendesk('messenger', 'hide');
      }));
    } catch { /* Older Messaging configurations may not expose events. */ }
  }

  private installStickyWidgetStyles(): void {
    if (document.getElementById('zendesk-stick-styles')) return;
    const style = document.createElement('style');
    style.id = 'zendesk-stick-styles';
    style.textContent = `
      body.zendesk-stick-mode iframe[title*="messaging window" i]:not([title*="button" i]) {
        position: fixed !important;
        top: 50% !important;
        right: 0 !important;
        bottom: auto !important;
        left: auto !important;
        max-height: calc(100vh - 40px) !important;
        transform: translate(105%, -50%) !important;
        transform-origin: right center !important;
        transition: transform .28s ease-out, opacity .2s ease-out !important;
        border-radius: 14px 0 0 14px !important;
        box-shadow: -12px 16px 40px rgba(16, 43, 78, .24) !important;
      }
      body.zendesk-stick-mode.zendesk-stick-open iframe[title*="messaging window" i]:not([title*="button" i]) {
        transform: translate(0, -50%) !important;
      }
      @media (max-width: 600px) {
        body.zendesk-stick-mode iframe[title*="messaging window" i]:not([title*="button" i]) {
          top: 0 !important;
          max-height: 100vh !important;
          transform: translateX(105%) !important;
          border-radius: 0 !important;
        }
        body.zendesk-stick-mode.zendesk-stick-open iframe[title*="messaging window" i]:not([title*="button" i]) {
          transform: translateX(0) !important;
        }
      }
    `;
    document.head.appendChild(style);
    document.body.classList.add('zendesk-stick-mode');
  }

  private sandboxUrl(client: string, mode: 'float' | 'stick'): string {
    return `/sandbox?sandboxSession=1&client=${encodeURIComponent(client)}&mode=${mode}`;
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
    document.body.classList.remove('zendesk-stick-mode', 'zendesk-stick-open');
    document.getElementById('zendesk-stick-styles')?.remove();
  }
}
