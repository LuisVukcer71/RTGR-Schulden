import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddBillComponent } from './add-bill';

describe('AddBillComponent', () => {
  let component: AddBillComponent;
  let fixture: ComponentFixture<AddBillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddBillComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AddBillComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
