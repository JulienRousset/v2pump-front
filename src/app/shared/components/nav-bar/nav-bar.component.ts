import { Component, OnInit, OnDestroy } from '@angular/core';
import { SolanaService } from '@shared/services/solana.service';
import { UtilsService } from '@shared/services/utils.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { EventsService } from 'src/app/events.service';

@Component({
  selector: 'app-nav-bar',
  templateUrl: './nav-bar.component.html',
  styleUrls: ['./nav-bar.component.scss'],
})
export class NavBarComponent implements OnInit, OnDestroy {
  public walletAddress!: string;
  public truncatedAddress!: string;
  public msg: any = '';
  public openModal = false;
  subscriptionSwap?: Subscription;

  // Ajout du Subject pour le debounce
  private searchSubject = new Subject<any>();

  constructor(
    public utils: UtilsService,
    public solanaService: SolanaService,
    private eventsService: EventsService
  ) { }

  ngOnInit() {
    // Configuration du debounce
    this.searchSubject.pipe(
      debounceTime(300)
    ).subscribe(value => {
      this.openModal = true;
    });
    this.subscriptionSwap = this.eventsService.transactionFinalized$.subscribe((signature: string) => {
      if(this.solanaService.wallet.publicKey){
        this.solanaService.updateBalance(this.solanaService.wallet.publicKey);
      }
    });
  }

  onSearchChange(e: any) {
    // Émission de la valeur dans le Subject
    this.searchSubject.next(e);
  }

  ngOnDestroy() {
    // Nettoyage du Subject
    this.searchSubject.complete();
    this.subscriptionSwap?.unsubscribe();

  }

  async connectWallet() {
    try {
      await this.solanaService.connect();
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  }

  async disconnectWallet() {
    try {
      await this.solanaService.disconnect();
    } catch (error) {
      console.error('Erreur de déconnexion:', error);
    }
  }
}
