import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KimcoDBChanges } from './kimco-dbchanges';

describe('KimcoDBChanges', () => {
  let component: KimcoDBChanges;
  let fixture: ComponentFixture<KimcoDBChanges>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KimcoDBChanges]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KimcoDBChanges);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
