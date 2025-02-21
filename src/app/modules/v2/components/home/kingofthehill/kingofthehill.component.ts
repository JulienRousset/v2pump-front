import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-kingofthehill',
  templateUrl: './kingofthehill.component.html',
  styleUrls: ['./kingofthehill.component.scss']
})
export class KingOfTheHillComponent implements OnInit {

  private readonly apiUrl = 'https://souctnjaypcptqpeeuhh.supabase.co/functions/v1/pumpfun/coins/king-of-the-hill?includeNsfw=false';
  countdown: number = 15;
  private countdownSubscription?: Subscription;
  private topicsSubscription?: Subscription;
  coin: any;

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadTopics();
    this.startCountdown();
  }


  ngOnDestroy() {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
    }
    if (this.topicsSubscription) {
      this.topicsSubscription.unsubscribe();
    }
  }

  private startCountdown() {
    this.countdownSubscription = interval(1000).subscribe(() => {
      if (this.countdown === 0) {
        this.countdown = 15;
        this.loadTopics();
      } else {
        this.countdown--;
      }
    });
  }

  private loadTopics() {
    this.topicsSubscription = this.http.get(this.apiUrl).subscribe({
      next: (response: any) => {
        this.coin = {
          id: response.for_you_id, // Ajoutez cet ID pour le système de trending
          name: response.name,
          creator: response.creator,
          marketCap: response.usd_market_cap,
          replies: response.reply_count,
          ticker: response.symbol,
          mint: response.mint,
          description: response.description,
          timestamp: response.created_timestamp,
          ray: response.complete,
          king: response.king_of_the_hill_timestamp,
          image: response.image_uri.replace(/cf-ipfs\.com/g, 'ipfs.io')
        }
      },
      error: (error) => {
        console.error('Error loading trending topics:', error);
      }
    });
  }


}
