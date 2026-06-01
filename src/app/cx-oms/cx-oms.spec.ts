import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CxOms } from './cx-oms';

describe('CxOms', () => {
  let component: CxOms;
  let fixture: ComponentFixture<CxOms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CxOms]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CxOms);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
