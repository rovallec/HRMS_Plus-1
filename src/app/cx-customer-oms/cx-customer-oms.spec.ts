import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CxCustomerOms } from './cx-customer-oms';

describe('CxCustomerOms', () => {
  let component: CxCustomerOms;
  let fixture: ComponentFixture<CxCustomerOms>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CxCustomerOms]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CxCustomerOms);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
