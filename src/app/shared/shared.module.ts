import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MaterialModule } from '@material/material.module';

import { FooterComponent } from './components/footer/footer.component';
import { NavBarComponent } from './components/nav-bar/nav-bar.component';
import { ModalLoaderComponent } from './components/modal-loader/modal-loader.component';
import { ShortenAddressPipe } from '../shorten-address.pipe';
import { ShortenNumberPipe } from '../shorten-number.pipe';
import { ModalSearchComponent } from './components/modal-search/modal-search.component';
import { ModalComponent } from './components/modal/modal.component';
import { DropdownComponent } from './components/dropdown/dropdown.component';
import { EditAvatarComponent } from './components/edit-avatar/edit-avatar.component';
import { SafePipe } from '../safe.pipe';
import { AvatarConfigComponent } from './components/edit-avatar/avatar-config/avatar-config.component';
import { AutoResizeTextDirective } from './directives/auto-resize-text.directive';
import { AvatarComponent } from './components/avatar/avatar.component';

const COMPONENTS = [
  FooterComponent,
  NavBarComponent,
  ModalLoaderComponent,
  ShortenAddressPipe,
  ShortenNumberPipe,
  ModalSearchComponent,
  ModalComponent,
  DropdownComponent,
  EditAvatarComponent,
  AvatarConfigComponent,
  SafePipe,
  AutoResizeTextDirective,
  AvatarComponent
]

@NgModule({
  declarations: [
    COMPONENTS,
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MaterialModule,
  ],
  exports: [
    COMPONENTS
  ],
  providers: []
})
export class SharedModule { }
