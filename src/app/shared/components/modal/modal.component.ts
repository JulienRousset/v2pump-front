import { Component, Input, Output, EventEmitter, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent implements OnInit {
  @Input() set isOpen(value: boolean) {
    this._isOpen = value;
    if (!value) {
      setTimeout(() => {
        this.isOpenChange.emit(this._isOpen);
      }, 300);
    } else {
      this.isOpenChange.emit(this._isOpen);
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }
  public _isOpen = false;
  @Output() isOpenChange = new EventEmitter<boolean>();


  constructor() {
  }

  ngOnInit() {
  }

  closeModal() {
    this.isOpen = false;
    this.isOpenChange.emit(false);
  }

}
