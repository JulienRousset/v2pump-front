import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-modal-loader',
  templateUrl: './modal-loader.component.html',
  styleUrls: ['./modal-loader.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('0.3s', style({ opacity: 0 }))
      ])
    ]),
  ]
})
export class ModalLoaderComponent {

  @Input() text: string | undefined;
  @Input() cssClasses: string[] = [];
  @Input() isLoading: boolean | undefined;
  @Output() isLoadingChange = new EventEmitter<boolean>();

}
