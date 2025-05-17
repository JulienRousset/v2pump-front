import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { ChartComponent } from './components/chart/chart.component';
import { AccountComponent } from './components/account/account.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'coin/:id', component: ChartComponent },
  { path: 'account/:id', component: AccountComponent }


];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ChatRoutingModule { }
