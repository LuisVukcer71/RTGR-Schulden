import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AusgabenUebersichtComponent } from './ausgaben-uebersicht';

describe('AusgabenUebersichtComponent', () => {
  let component: AusgabenUebersichtComponent;
  let fixture: ComponentFixture<AusgabenUebersichtComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AusgabenUebersichtComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AusgabenUebersichtComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
