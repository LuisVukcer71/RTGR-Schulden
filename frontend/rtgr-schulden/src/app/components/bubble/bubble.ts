import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'bubble',
  imports: [CommonModule],
  templateUrl: './bubble.html',
  styleUrl: './bubble.css',
})
export class Bubble {
  @Input() width: string = '100%';
  @Input() height: string = 'auto';
}
