import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenWA } from './open-wa';

describe('OpenWA', () => {
  let component: OpenWA;
  let fixture: ComponentFixture<OpenWA>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OpenWA]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OpenWA);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
