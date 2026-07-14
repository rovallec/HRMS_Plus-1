import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TaService } from '../services/ta.service';
import { TaField, TaFieldType, TaForm, TaQuestionGroup, TaSubmission } from './ta.models';

@Component({ selector: 'app-ta-admin', standalone: true, imports: [CommonModule, FormsModule, RouterModule], templateUrl: './ta-admin.html', styleUrl: './ta-admin.css' })
export class TaAdmin implements OnInit {
  tab: 'builder' | 'submissions' = 'builder';
  forms: TaForm[] = []; submissions: TaSubmission[] = [];
  selectedSubmission: TaSubmission | null = null; selectedFormId: number | null = null;
  saving = false; message = ''; formListOpen = true; basicOpen = true; rulesOpen = true; poolsOpen = true; questionsOpen = true;
  expandedQuestions = new Set<number>();
  countrySearch = '';
  readonly countries = this.buildCountries();
  fieldTypes: { value: TaFieldType; label: string }[] = [
    { value: 'short_text', label: 'Short text' }, { value: 'long_text', label: 'Long text' }, { value: 'rich_text', label: 'Formatted text' },
    { value: 'number', label: 'Number' }, { value: 'phone', label: 'Phone number' }, { value: 'email', label: 'Email' },
    { value: 'single_choice', label: 'Single choice' }, { value: 'multiple_choice', label: 'Multiple choice' },
    { value: 'pdf', label: 'PDF attachment' }, { value: 'image', label: 'Image attachment' }
  ];
  form: TaForm = this.blankForm();

  constructor(private api: TaService) {}
  ngOnInit(): void { this.loadForms(); }
  blankForm(): TaForm { return { slug: '', title: '', description: '', layout: 'single', isPublic: true, requireAuth: false, allowGeolocation: false, restrictCountries: false, allowedCountries: [], availableUntil: null, timeLimitMinutes: null, maxAttempts: 1, status: 'draft', fields: [], questionGroups: [] }; }
  normalize(form: TaForm): TaForm { form.questionGroups ||= []; form.restrictCountries ??= false; form.allowedCountries ||= []; form.fields.forEach(f => f.groupId ??= null); return form; }
  loadForms(): void { this.api.listForms().subscribe({ next: r => this.forms = r.data.map(f => this.normalize(f)), error: e => this.message = e.error?.error || 'Forms could not be loaded.' }); }
  newForm(): void { this.selectedFormId = null; this.form = this.blankForm(); this.message = ''; this.expandedQuestions.clear(); }
  edit(form: TaForm): void { this.selectedFormId = form.id!; this.form = this.normalize(JSON.parse(JSON.stringify(form))); this.tab = 'builder'; this.expandedQuestions.clear(); }
  addField(section = 'General', groupId: string | null = null): void { this.form.fields.push({ id: crypto.randomUUID(), label: 'New question', type: 'short_text', required: false, section, groupId, options: [], showInTable: false }); this.expandedQuestions.add(this.form.fields.length - 1); }
  removeField(index: number): void { this.form.fields.splice(index, 1); this.expandedQuestions.clear(); }
  move(index: number, direction: number): void { const target = index + direction; if (target < 0 || target >= this.form.fields.length) return; [this.form.fields[index], this.form.fields[target]] = [this.form.fields[target], this.form.fields[index]]; }
  toggleQuestion(index: number): void { this.expandedQuestions.has(index) ? this.expandedQuestions.delete(index) : this.expandedQuestions.add(index); }
  needsOptions(field: TaField): boolean { return field.type === 'single_choice' || field.type === 'multiple_choice'; }
  typeLabel(type: TaFieldType): string { return this.fieldTypes.find(item => item.value === type)?.label || type; }
  optionsText(field: TaField): string { return field.options.join('\n'); }
  setOptions(field: TaField, value: string): void { field.options = value.split('\n').map(v => v.trim()).filter(Boolean); }
  sectionNames(): string[] { return [...new Set([...this.form.fields.map(f => f.section.trim() || 'General'), ...this.form.questionGroups.map(g => g.section.trim() || 'General')])]; }
  addGroup(section = 'General'): void { this.form.questionGroups.push({ id: crypto.randomUUID(), name: `Question pool ${this.form.questionGroups.length + 1}`, section, mode: 'random', questionsToShow: 1 }); }
  removeGroup(group: TaQuestionGroup): void { this.form.fields.filter(f => f.groupId === group.id).forEach(f => f.groupId = null); this.form.questionGroups = this.form.questionGroups.filter(g => g.id !== group.id); }
  groupsFor(section: string): TaQuestionGroup[] { return this.form.questionGroups.filter(g => g.section === section); }
  availableGroups(field: TaField): TaQuestionGroup[] { return this.groupsFor(field.section || 'General'); }
  groupCount(group: TaQuestionGroup): number { return this.form.fields.filter(f => f.groupId === group.id).length; }
  ungroupedCount(section: string): number { return this.form.fields.filter(f => (f.section || 'General') === section && !f.groupId).length; }
  updateGroupSection(group: TaQuestionGroup, oldSection: string): void { this.form.fields.filter(f => f.groupId === group.id && f.section === oldSection).forEach(f => f.section = group.section); }
  buildCountries(): { code: string; name: string }[] { const codes = 'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '); const display = typeof Intl !== 'undefined' && (Intl as any).DisplayNames ? new (Intl as any).DisplayNames(['en'], { type: 'region' }) : null; return codes.map(code => ({ code, name: display?.of(code) || code })).sort((a,b) => a.name.localeCompare(b.name)); }
  get filteredCountries(): { code: string; name: string }[] { const q = this.countrySearch.toLowerCase().trim(); return q ? this.countries.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) : this.countries; }
  countrySelected(code: string): boolean { return this.form.allowedCountries.includes(code); }
  toggleCountry(code: string): void { this.form.allowedCountries = this.countrySelected(code) ? this.form.allowedCountries.filter(c => c !== code) : [...this.form.allowedCountries, code]; }
  save(): void {
    this.message = '';
    if (!this.form.title.trim() || !this.form.slug.trim() || !this.form.fields.length) { this.message = 'Title, URL, and at least one question are required.'; return; }
    if (this.form.restrictCountries && !this.form.allowedCountries.length) { this.message = 'Select at least one allowed country.'; return; }
    for (const group of this.form.questionGroups) if (!this.groupCount(group)) { this.message = `“${group.name}” has no questions.`; return; } else if (group.mode === 'random' && (!group.questionsToShow || group.questionsToShow > this.groupCount(group))) { this.message = `Choose between 1 and ${this.groupCount(group)} questions for “${group.name}”.`; return; }
    this.form.slug = this.form.slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-'); this.saving = true;
    this.api.saveForm(this.form).subscribe({ next: r => { this.form = this.normalize(r.data); this.selectedFormId = r.data.id!; this.saving = false; this.message = 'Form saved.'; this.loadForms(); }, error: e => { this.saving = false; this.message = e.error?.error || `The form could not be saved (HTTP ${e.status || 0}).`; } });
  }
  remove(form: TaForm): void { if (!form.id || !confirm(`Delete “${form.title}” and all of its submissions?`)) return; this.api.deleteForm(form.id).subscribe(() => { if (this.selectedFormId === form.id) this.newForm(); this.loadForms(); }); }
  openSubmissions(form?: TaForm): void { this.tab = 'submissions'; this.selectedFormId = form?.id || null; this.selectedSubmission = null; this.api.listSubmissions(this.selectedFormId || undefined).subscribe({ next: r => this.submissions = r.data, error: e => this.message = e.error?.error || 'Submissions could not be loaded.' }); }
  formFor(id: number): TaForm | undefined { return this.forms.find(f => f.id === id); }
  get selectedVisibleFields(): TaField[] { return (this.selectedFormId ? this.formFor(this.selectedFormId)?.fields : [])?.filter(f => f.showInTable) || []; }
  display(value: unknown): string { return Array.isArray(value) ? value.join(', ') : value == null ? '—' : String(value); }
}
