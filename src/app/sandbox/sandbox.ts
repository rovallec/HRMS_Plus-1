import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
  displayMode: 'float' | 'stick' | 'link' | 'button' = 'float';
  isWidgetOpen = false;
  stickyFrameUrl: SafeResourceUrl | null = null;
  contentView: 'feedback' | 'code' = 'feedback';
  activeCodeTab: 'html' | 'css' | 'ts' = 'html';
  loading = false;
  authorized = false;
  requestSent = false;
  feedbackSaved = false;
  error = '';
  hasAccessToken = false;
  private widgetKey = '';

  @ViewChild('zendeskFrame') zendeskFrame?: ElementRef<HTMLIFrameElement>;

  constructor(private route: ActivatedRoute, private api: SandboxService, private sanitizer: DomSanitizer) {}

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
    this.displayMode = this.isDisplayMode(requestedMode) ? requestedMode : 'float';
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

  switchDisplayMode(mode: 'float' | 'stick' | 'link' | 'button'): void {
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

  showCodeGuide(): void {
    this.contentView = 'code';
  }

  showFeedback(): void {
    this.contentView = 'feedback';
  }

  get codeSections(): Array<{ kind: 'zendesk' | 'design' | 'launcher' | 'base'; text: string }> {
    const examples = this.displayMode === 'stick'
      ? this.stickCodeExamples
      : this.displayMode === 'link'
        ? this.linkCodeExamples
        : this.displayMode === 'button'
          ? this.buttonCodeExamples
          : this.floatCodeExamples;
    return examples[this.activeCodeTab];
  }

  private readonly floatCodeExamples = {
    html: [
      { kind: 'zendesk' as const, text: `<!-- Zendesk Messaging -->\n<script id="ze-snippet"\n  src="https://static.zdassets.com/ekr/snippet.js?key=YOUR_ZENDESK_KEY">\n</script>` },
      { kind: 'launcher' as const, text: `\n\n<!-- Zendesk renders its native floating launcher automatically. -->` }
    ],
    css: [
      { kind: 'base' as const, text: `/* No positioning CSS is required in Float mode. */\n` },
      { kind: 'design' as const, text: `.sandbox-content {\n  min-height: 100vh;\n  background: #f6f7f9;\n}` }
    ],
    ts: [
      { kind: 'zendesk' as const, text: `loadZendesk(): void {\n  const script = document.createElement('script');\n  script.id = 'ze-snippet';\n  script.src =\n    'https://static.zdassets.com/ekr/snippet.js?key=YOUR_ZENDESK_KEY';\n  script.async = true;\n  document.body.appendChild(script);\n}` }
    ]
  };

  private readonly stickCodeExamples = {
    html: [
      { kind: 'design' as const, text: `<div class="chat-shell" [class.open]="chatOpen">\n  <iframe\n    #chatFrame\n    src="/zendesk-frame.html?key=YOUR_ZENDESK_KEY"\n    title="Customer support chat">\n  </iframe>\n</div>` },
      { kind: 'launcher' as const, text: `\n\n<button class="chat-launcher" (click)="toggleChat()">\n  <i class="bi bi-chat-dots-fill"></i>\n  <span>{{ chatOpen ? 'Hide chat' : 'Open chat' }}</span>\n</button>` },
      { kind: 'zendesk' as const, text: `\n\n<!-- zendesk-frame.html: Zendesk-specific behavior -->\n<script>\n  const key = new URLSearchParams(location.search).get('key');\n  const snippet = document.createElement('script');\n\n  snippet.id = 'ze-snippet';\n  snippet.src =\n    'https://static.zdassets.com/ekr/snippet.js?key=' +\n    encodeURIComponent(key || 'YOUR_ZENDESK_KEY');\n\n  snippet.onload = () => {\n    // Zendesk Messaging API: suppress the native launcher.\n    window.zE('messenger', 'hide');\n  };\n\n  document.head.appendChild(snippet);\n\n  window.addEventListener('message', event => {\n    if (event.origin !== location.origin) return;\n    if (event.data?.type !== 'open-zendesk-messaging') return;\n\n    // Zendesk Messaging API: reveal and open the conversation.\n    window.zE('messenger', 'show');\n    window.zE('messenger', 'open');\n  });\n</script>` },
      { kind: 'base' as const, text: `\n\n<!-- Everything below is normal front-end styling and can be changed freely:\n     width, height, spacing, border radius, shadows, colors,\n     responsive breakpoints, transition speed and easing. -->` }
    ],
    css: [
      { kind: 'design' as const, text: `.chat-shell {\n  position: fixed;\n  top: 50%;\n  right: 2rem;\n  width: min(430px, calc(100vw - 100px));\n  height: min(700px, calc(100vh - 64px));\n  opacity: 0;\n  pointer-events: none;\n  transform: translate(115%, -50%) scale(.98);\n  transition: transform .34s ease, opacity .2s ease;\n}\n\n.chat-shell.open {\n  opacity: 1;\n  pointer-events: auto;\n  transform: translate(0, -50%) scale(1);\n}` },
      { kind: 'launcher' as const, text: `\n\n.chat-launcher {\n  position: fixed;\n  right: 0;\n  top: 50%;\n  border-radius: 15px 0 0 15px;\n  background: #102b4e;\n  color: white;\n}\n\n.chat-launcher.open {\n  /* Move the controller with the panel. */\n  right: calc(2rem + min(430px, calc(100vw - 100px)));\n}` }
    ],
    ts: [
      { kind: 'launcher' as const, text: `chatOpen = false;\n\ntoggleChat(): void {\n  this.chatOpen = !this.chatOpen;\n  if (this.chatOpen) this.openZendeskInsideFrame();\n}` },
      { kind: 'zendesk' as const, text: `\n\nopenZendeskInsideFrame(): void {\n  this.chatFrame.nativeElement.contentWindow?.postMessage(\n    { type: 'open-zendesk-messaging' },\n    window.location.origin\n  );\n}` },
      { kind: 'design' as const, text: `\n\n// The outer iframe is animated by the host page.\n// Zendesk remains mounted, so hiding the panel preserves the conversation.` }
    ]
  };

  private readonly linkCodeExamples = {
    html: [
      { kind: 'launcher' as const, text: `<a href="#support" class="contact-link" (click)="openChat($event)">\n  Contact us\n  <i class="bi bi-arrow-up-right"></i>\n</a>` },
      { kind: 'design' as const, text: `\n\n<div class="chat-modal" [class.open]="chatOpen">\n  <iframe src="/zendesk-frame.html?key=YOUR_ZENDESK_KEY"\n    title="Customer support chat"></iframe>\n</div>` },
      { kind: 'zendesk' as const, text: `\n\n<!-- zendesk-frame.html receives an open message and calls:\n     zE('messenger', 'show');\n     zE('messenger', 'open'); -->` }
    ],
    css: [
      { kind: 'launcher' as const, text: `.contact-link {\n  display: inline-flex;\n  align-items: center;\n  gap: .5rem;\n  color: #102b4e;\n  font-weight: 700;\n  text-decoration-thickness: 2px;\n}` },
      { kind: 'design' as const, text: `\n\n/* Modal dimensions, spacing, animation and backdrop are\n   normal design decisions and can be adapted freely. */\n.chat-modal {\n  position: fixed;\n  inset: 0;\n  display: grid;\n  place-items: center;\n}` }
    ],
    ts: [
      { kind: 'launcher' as const, text: `openChat(event: Event): void {\n  event.preventDefault();\n  this.chatOpen = true;\n  this.openZendeskInsideFrame();\n}` },
      { kind: 'zendesk' as const, text: `\n\nopenZendeskInsideFrame(): void {\n  this.chatFrame.nativeElement.contentWindow?.postMessage(\n    { type: 'open-zendesk-messaging' },\n    window.location.origin\n  );\n}` }
    ]
  };

  private readonly buttonCodeExamples = {
    html: [
      { kind: 'launcher' as const, text: `<button type="button" class="contact-button" (click)="openChat()">\n  <i class="bi bi-chat-dots-fill"></i>\n  Contact us\n</button>` },
      { kind: 'design' as const, text: `\n\n<div class="chat-modal" [class.open]="chatOpen">\n  <iframe src="/zendesk-frame.html?key=YOUR_ZENDESK_KEY"\n    title="Customer support chat"></iframe>\n</div>` },
      { kind: 'zendesk' as const, text: `\n\n<!-- The iframe owns the Zendesk-specific hide/show/open calls. -->` }
    ],
    css: [
      { kind: 'launcher' as const, text: `.contact-button {\n  display: inline-flex;\n  align-items: center;\n  gap: .65rem;\n  padding: .85rem 1.25rem;\n  border: 0;\n  border-radius: 999px;\n  background: #102b4e;\n  color: white;\n  font-weight: 700;\n}` },
      { kind: 'design' as const, text: `\n\n/* The host application owns modal layout and transitions. */\n.chat-modal {\n  opacity: 0;\n  transform: translateY(1rem) scale(.98);\n  transition: opacity .2s ease, transform .3s ease;\n}\n.chat-modal.open {\n  opacity: 1;\n  transform: translateY(0) scale(1);\n}` }
    ],
    ts: [
      { kind: 'launcher' as const, text: `openChat(): void {\n  this.chatOpen = true;\n  this.openZendeskInsideFrame();\n}\n\ncloseChat(): void {\n  this.chatOpen = false;\n}` },
      { kind: 'zendesk' as const, text: `\n\n// postMessage keeps Zendesk isolated from the host UI implementation.` }
    ]
  };

  private setWidgetKey(client: string): void {
    this.widgetKey = client === 'MarcJacobs'
      ? 'c71de9c3-3113-4643-aa00-61f4674ecb1d'
      : 'ad7b3975-31a2-4995-a60b-1fd9869c9163';
    this.stickyFrameUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `/zendesk-frame.html?key=${encodeURIComponent(this.widgetKey)}`
    );
  }

  private loadWidget(): void {
    if (this.displayMode !== 'float') return;
    if (!this.widgetKey || document.getElementById('ze-snippet')) return;
    const script = document.createElement('script');
    script.id = 'ze-snippet';
    script.src = `https://static.zdassets.com/ekr/snippet.js?key=${this.widgetKey}`;
    script.async = true;
    document.body.appendChild(script);
  }

  openStickyWidget(): void {
    this.isWidgetOpen = !this.isWidgetOpen;
    if (this.isWidgetOpen) this.sendOpenToStickyFrame();
  }

  openModalWidget(event?: Event): void {
    event?.preventDefault();
    this.isWidgetOpen = true;
    setTimeout(() => this.sendOpenToStickyFrame());
  }

  closeModalWidget(): void {
    this.isWidgetOpen = false;
  }

  onStickyFrameLoad(): void {
    if (this.isWidgetOpen) this.sendOpenToStickyFrame();
  }

  private sendOpenToStickyFrame(): void {
    this.zendeskFrame?.nativeElement.contentWindow?.postMessage(
      { type: 'cx-sandbox-open-zendesk' }, window.location.origin
    );
  }

  private sandboxUrl(client: string, mode: 'float' | 'stick' | 'link' | 'button'): string {
    return `/sandbox?sandboxSession=1&client=${encodeURIComponent(client)}&mode=${mode}`;
  }

  private isDisplayMode(value: string | null): value is 'float' | 'stick' | 'link' | 'button' {
    return value === 'float' || value === 'stick' || value === 'link' || value === 'button';
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
