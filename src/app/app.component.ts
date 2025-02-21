import { Component } from '@angular/core';
import { SolanaService } from '@shared/services/solana.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {

  constructor(public solana: SolanaService) {}


  async ngOnInit(){
  }

}
