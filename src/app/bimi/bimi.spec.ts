import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bimi } from './bimi';

describe('Bimi', () => {
  let component: Bimi;
  let fixture: ComponentFixture<Bimi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Bimi]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Bimi);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
