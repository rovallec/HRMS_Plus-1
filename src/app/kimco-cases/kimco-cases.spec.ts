import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KimcoCases } from './kimco-cases';

describe('KimcoCases', () => {
  let component: KimcoCases;
  let fixture: ComponentFixture<KimcoCases>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KimcoCases]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KimcoCases);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
