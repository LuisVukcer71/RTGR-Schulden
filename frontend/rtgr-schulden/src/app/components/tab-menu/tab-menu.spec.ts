import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabMenuComponent } from './tab-menu';

describe('TabMenuComponent', () => {
  let component: TabMenuComponent;
  let fixture: ComponentFixture<TabMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TabMenuComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
