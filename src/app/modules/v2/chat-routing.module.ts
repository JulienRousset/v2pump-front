import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { ChartComponent } from './components/chart/chart.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'coin/:id', component: ChartComponent }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ChatRoutingModule { }
