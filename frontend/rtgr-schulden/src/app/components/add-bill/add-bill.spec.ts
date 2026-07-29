import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBill } from './add-bill';

describe('AddBill', () => {
  let component: AddBill;
  let fixture: ComponentFixture<AddBill>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBill],
    }).compileComponents();

    fixture = TestBed.createComponent(AddBill);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
