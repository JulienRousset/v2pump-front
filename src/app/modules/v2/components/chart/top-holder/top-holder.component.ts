import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

interface HolderResponse {
  status: string;
  data: HolderData[];
  source: string;
  lastUpdate: string;
  nextUpdate: string;
}

interface HolderData {
  address: string;
  amount: string;
  uiAmount: number;
  owner: string;
}

@Component({
  selector: 'app-top-holder',
  templateUrl: './top-holder.component.html',
  styleUrls: ['./top-holder.component.scss'],
})
export class TopHolderComponent implements OnInit {
  @Input() coinId: string = '';
  @Input() token: any;

  @Input() set lastBar(value: number) {
    if (value !== this._lastBar) {
      this._lastBar = value;
      this.updateSubject.next();
    }
  }
  get lastBar(): number {
    return this._lastBar;
  }
  private _lastBar: number = 0;


  holders: HolderData[] = [];
  loading: boolean = true;
  error: string | null = null;
  lastUpdate: string = '';

    // Ajout des variables pour la gestion des updates
    private updateSubject = new Subject<void>();
    private isUpdating = false;
    private updateQueued = false;
    private readonly THROTTLE_DELAY = 10000;
  
  constructor(private http: HttpClient) {
    this.updateSubject.pipe(
      throttleTime(this.THROTTLE_DELAY, undefined, { leading: true, trailing: false })
    ).subscribe(() => {
      this.processUpdate();
    });
  }
  ngOnInit() {
    // this.fetchHolders();
  }

  private async processUpdate() {
    if (this.isUpdating) {
      this.updateQueued = true;
      return;
    }

    try {
      this.isUpdating = true;
      console.log('Début de la mise à jour des holders:', new Date().toISOString());
      await this.fetchHolders();
    } catch (error) {
      console.error('Error updating holders:', error);
    } finally {
      this.isUpdating = false;
      console.log('Fin de la mise à jour des holders:', new Date().toISOString());

      if (this.updateQueued) {
        this.updateQueued = false;
        setTimeout(() => {
          this.processUpdate();
        }, this.THROTTLE_DELAY);
      }
    }
  }

  private triggerUpdate() {
  }

  fetchHolders() {
    this.error = null;

    return new Promise((resolve, reject) => {
      this.http.get<HolderResponse>(`https://souctnjaypcptqpeeuhh.supabase.co/functions/v1/top-holder?mint=${this.coinId}`)
        .subscribe({
          next: (response) => {
            if (response.status === 'success') {
              this.holders = response.data;
              this.lastUpdate = response.lastUpdate;
            }
            this.loading = false;
            resolve(response);
          },
          error: (err) => {
            console.error('Error fetching holders:', err);
            this.error = 'Failed to load holders data';
            this.loading = false;
            reject(err);
          }
        });
    });
  }

  calculatePercentage(amount: string): number {
    if (!this.token?.supply || !this.token?.decimals) return 0;
    const actualAmount = Number(amount) / Math.pow(10, this.token.decimals);
    const totalSupply = Number(this.token.supply);
    return (actualAmount / totalSupply) * 100;
  }

  ngOnDestroy() {
    this.updateSubject.complete();
  }

}