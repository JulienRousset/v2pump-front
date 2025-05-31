import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-trendingmeta',
  templateUrl: './trendingmeta.component.html',
  styleUrls: ['./trendingmeta.component.scss']
})
export class TrendingMetaComponent implements OnInit {
  @Input() trending: any;
  @Output() trendingChange = new EventEmitter<string>();

  private readonly apiUrl = 'https://souctnjaypcptqpeeuhh.supabase.co/functions/v1/pumpfun/metas/current';
  countdown: number = 30;
  private countdownSubscription?: Subscription;
  private topicsSubscription?: Subscription;
  trendingTopics: any = [];

  constructor(private http: HttpClient) { }

  ngOnInit() {
    this.loadTopics();
    this.startCountdown();
  }

  select(e: any) {
    if (this.trending == e.word) {
      this.trending = ''
    } else {
      this.trending = e.word
    }
    this.trendingChange.emit(e);
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
        this.countdown = 30;
        this.loadTopics();
      } else {
        this.countdown--;
      }
    });
  }

  private loadTopics() {
    this.topicsSubscription = this.http.get(this.apiUrl).subscribe({
      next: (response: any) => {
        this.trendingTopics = response;
      },
      error: (error) => {
        console.error('Error loading trending topics:', error);
      }
    });
  }


}
