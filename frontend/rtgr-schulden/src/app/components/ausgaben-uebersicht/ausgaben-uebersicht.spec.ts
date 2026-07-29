import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AusgabenUebersicht } from './ausgaben-uebersicht';

describe('AusgabenUebersicht', () => {
  let component: AusgabenUebersicht;
  let fixture: ComponentFixture<AusgabenUebersicht>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AusgabenUebersicht],
    }).compileComponents();

    fixture = TestBed.createComponent(AusgabenUebersicht);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
