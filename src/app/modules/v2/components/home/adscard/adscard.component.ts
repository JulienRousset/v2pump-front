import { HttpClient } from '@angular/common/http';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-adscard',
  templateUrl: './adscard.component.html',
  styleUrls: ['./adscard.component.scss']
})
export class AdsCardComponent implements OnInit {

  private readonly apiUrl = 'https://souctnjaypcptqpeeuhh.supabase.co/functions/v1/pumpfun/metas/current';
  countdown: number = 30;
  private countdownSubscription?: Subscription;
  private topicsSubscription?: Subscription;
  trendingTopics: any = [];

  constructor(private http: HttpClient) { }

  ngOnInit() {}



}
