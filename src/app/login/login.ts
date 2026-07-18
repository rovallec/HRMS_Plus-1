import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { AppeasementService } from '../services/appeasement.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent implements OnInit {
  usernameForm!: FormGroup;
  passwordForm!: FormGroup;
  stage: 'username' | 'password' = 'username';
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private api: AppeasementService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Production may rewrite a hard /sandbox reload to /login. Resume only
    // when this browser already owns a sandbox session; no access token is
    // reactivated or consumed again.
    const sandboxResume = this.route.snapshot.queryParamMap.get('sandboxSession');
    const sandboxClient = this.route.snapshot.queryParamMap.get('client');
    if (sandboxResume === '1' && sandboxClient && sessionStorage.getItem('sandboxSessionToken')) {
      this.router.navigate(['/sandbox'], {
        queryParams: { sandboxSession: 1, client: sandboxClient },
        replaceUrl: true
      });
      return;
    }

    /** ✅ Handle Azure Entra SSO callback */
    const tokenParam = this.route.snapshot.queryParamMap.get('token');
    if (tokenParam) {
      // Some production web-server fallbacks rewrite /sandbox?token=... to
      // /login?token=.... Only recover the exact sandbox token format here;
      // the backend still validates that it exists, is unused and is valid.
      if (/^[a-f0-9]{64}$/i.test(tokenParam)) {
        this.router.navigate(['/sandbox'], {
          queryParams: { token: tokenParam },
          replaceUrl: true
        });
        return;
      }

      try {
        const user = JSON.parse(atob(tokenParam)); // decode base64 payload

        // Store the full user info
        localStorage.setItem('user', JSON.stringify(user));

        // ✅ Store the access token for Graph API photo loading
        if (user.access_token) {
          localStorage.setItem('access_token', user.access_token);
        }

        // Optionally, store refresh token for future silent renewal
        if (user.refresh_token) {
          localStorage.setItem('refresh_token', user.refresh_token);
        }

      this.navigateAfterLogin(user);
        return;
      } catch (e) {
        console.error('Invalid token from SSO callback:', e);
      }
    }

    /** Initialize forms */
    this.usernameForm = this.fb.group({
      username: ['', Validators.required]
    });

    this.passwordForm = this.fb.group({
      password: ['', Validators.required]
    });
  }

  /** Step 1: Check username */
  onSubmit(): void {
    if (this.usernameForm.invalid) return;
    const username = this.usernameForm.value.username;

    this.api.login({ username }).subscribe({
      next: (res) => {
        if (res.status === 'sso') {
          // Redirect user to Microsoft login
          window.location.href = res.redirect;
        } else if (res.status === 'password_required') {
          this.stage = 'password';
        } else if (res.status === 'ok') {
          localStorage.setItem('user', JSON.stringify(res.user));
          this.navigateAfterLogin(res);
        }
      },
      error: (err) => {
        console.error('Login error:', err);
        this.errorMessage = err.error?.message || 'Login failed.';
      }
    });
  }

  /** Step 2: Authenticate locally with password */
  onPasswordSubmit(): void {
    if (this.passwordForm.invalid) return;

    const payload = {
      username: this.usernameForm.value.username,
      password: this.passwordForm.value.password
    };

    this.api.login(payload).subscribe({
      next: (res) => {
        if (res.status === 'ok') {
          localStorage.setItem('user', JSON.stringify(res.user));
          this.navigateAfterLogin(res);
        } else if (res.status === 'error') {
          this.errorMessage = res.message || 'Invalid credentials.';
        } else {
          this.errorMessage = 'Unexpected response.';
        }
      },
      error: (err) => {
        console.error('Password login error:', err);
        this.errorMessage = err.error?.message || 'Login failed.';
      }
    });
  }

  resetStage(): void {
    this.stage = 'username';
    this.errorMessage = '';
    this.passwordForm.reset();
  }

  private navigateAfterLogin(user: any): void {

  const returnUrl = sessionStorage.getItem('taReturnUrl');
  if (returnUrl?.startsWith('/ta/form/')) {
    sessionStorage.removeItem('taReturnUrl');
    this.router.navigateByUrl(returnUrl);
    return;
  }

  const role = Number(user?.user?.role || user?.role || 0);

  if (role === 7) {
    this.router.navigate(['/kimPm']);
  } else {
    this.router.navigate(['/appeasement/codes']);
  }

}
}
