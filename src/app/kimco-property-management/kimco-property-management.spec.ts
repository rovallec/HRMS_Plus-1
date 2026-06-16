import { ComponentFixture, TestBed } from '@angular/core/testing';

import { KimcoPropertyManagement } from './kimco-property-management';

describe('KimcoPropertyManagement', () => {
  let component: KimcoPropertyManagement;
  let fixture: ComponentFixture<KimcoPropertyManagement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KimcoPropertyManagement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(KimcoPropertyManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
