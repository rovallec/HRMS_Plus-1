import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TaService } from '../services/ta.service';
import { TaField, TaForm } from './ta.models';

@Component({ selector: 'app-ta-form', standalone: true, imports: [CommonModule, FormsModule, RouterModule], templateUrl: './ta-form.html', styleUrl: './ta-form.css' })
export class TaFormRenderer implements OnInit {
  form?: TaForm;
  answers: Record<string, any> = {};
  files: Record<string, File> = {};
  startedAt = new Date().toISOString();
  currentStep = 0;
  attemptsUsed = 0;
  loading = true;
  submitting = false;
  submitted = false;
  error = '';
  location?: GeolocationCoordinates;
  locationCountryCode = '';
  locationCountryName = '';
  locating = false;
  remainingSeconds: number | null = null;
  private timer?: number;
  private selectedFields: Record<string, TaField[]> = {};

  constructor(private route: ActivatedRoute, private router: Router, private api: TaService) {}
  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug')!;
    this.api.getForm(slug).subscribe({ next: r => { this.form = r.data; this.attemptsUsed = r.attemptsUsed; this.buildQuestionSet(); this.loading = false; this.startTimer(); this.requestLocation(); }, error: e => { this.loading = false; this.error = e.error?.error || 'This form is not available.'; } });
  }
  get sections(): string[] { return [...new Set((this.form?.fields || []).map(f => f.section || 'General'))]; }
  fieldsFor(section: string): TaField[] { return this.selectedFields[section] || []; }
  get displayedFields(): TaField[] { return Object.values(this.selectedFields).flat(); }
  private buildQuestionSet(): void {
    const groups = this.form?.questionGroups || [];
    for (const section of this.sections) {
      const sectionFields = (this.form?.fields || []).filter(f => (f.section || 'General') === section);
      const sectionGroups = groups.filter(group => group.section === section);
      const validGroupIds = new Set(sectionGroups.map(group => group.id));
      const selected = sectionFields.filter(field => !field.groupId || !validGroupIds.has(field.groupId));
      for (const group of sectionGroups) {
        const pool = sectionFields.filter(field => field.groupId === group.id);
        selected.push(...(group.mode === 'random' ? [...pool].sort(() => Math.random() - .5).slice(0, Math.min(group.questionsToShow || pool.length, pool.length)) : pool));
      }
      this.selectedFields[section] = selected.sort((a, b) => (this.form?.fields.indexOf(a) || 0) - (this.form?.fields.indexOf(b) || 0));
    }
  }
  visibleSections(): string[] { return this.form?.layout === 'steps' ? [this.sections[this.currentStep]] : this.sections; }
  toggle(field: TaField, value: string, checked: boolean): void { const values: string[] = this.answers[field.id] || []; this.answers[field.id] = checked ? [...values, value] : values.filter(v => v !== value); }
  chooseFile(field: TaField, event: Event): void { const file = (event.target as HTMLInputElement).files?.[0]; if (file) { this.files[field.id] = file; this.answers[field.id] = file.name; } }
  validate(fields = this.displayedFields): boolean {
    for (const field of fields) if (field.required && (!this.answers[field.id] || (Array.isArray(this.answers[field.id]) && !this.answers[field.id].length))) { this.error = `Complete the required field: ${field.label}`; return false; }
    this.error = ''; return true;
  }
  next(): void { if (this.validate(this.fieldsFor(this.sections[this.currentStep]))) this.currentStep++; }
  submit(): void {
    if (!this.form?.id || !this.validate()) return;
    if (this.remainingSeconds === 0) { this.error = 'The time allowed to complete this form has expired.'; return; }
    this.submitting = true;
    if (this.form.restrictCountries && (!this.location || !this.locationCountryCode)) { this.error = 'Your location and country are required to submit this form.'; return; }
    if (this.form.restrictCountries && !this.form.allowedCountries.includes(this.locationCountryCode)) { this.error = `This form is not available in ${this.locationCountryName || 'your country'}.`; return; }
    this.api.submit(this.form.id, this.answers, this.files, this.startedAt, this.displayedFields.map(f => f.id), this.location, this.locationCountryCode).subscribe({ next: () => { this.submitting = false; this.submitted = true; if (this.timer) clearInterval(this.timer); }, error: e => { this.submitting = false; this.error = e.error?.error || 'The form could not be submitted.'; } });
  }
  requestLocation(): void { if (!this.form?.allowGeolocation || !navigator.geolocation) return; this.locating = true; navigator.geolocation.getCurrentPosition(async p => { this.location = p.coords; try { const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}&localityLanguage=en`); const data = await response.json(); this.locationCountryCode = String(data.countryCode || '').toUpperCase(); this.locationCountryName = String(data.countryName || this.locationCountryCode); if (this.form?.restrictCountries && !this.form.allowedCountries.includes(this.locationCountryCode)) this.error = `This form is not available in ${this.locationCountryName || 'your country'}.`; } catch { if (this.form?.restrictCountries) this.error = 'Your country could not be verified. Please try again.'; } finally { this.locating = false; } }, () => { this.locating = false; if (this.form?.restrictCountries) this.error = 'Location permission is required to access this form.'; }, { timeout: 10000, enableHighAccuracy: false }); }
  startTimer(): void { if (!this.form?.timeLimitMinutes) return; this.remainingSeconds = this.form.timeLimitMinutes * 60; this.timer = window.setInterval(() => { if (this.remainingSeconds !== null && this.remainingSeconds > 0) this.remainingSeconds--; }, 1000); }
  formatTime(): string { const n = this.remainingSeconds || 0; return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; }
  isLoggedIn(): boolean { return !!localStorage.getItem('user'); }
  login(): void { sessionStorage.setItem('taReturnUrl', this.router.url); this.router.navigate(['/login']); }
}
