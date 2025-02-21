import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FeedService } from 'src/app/feed.service';
import { TokenService } from 'src/app/token.service';


@Component({
  selector: 'app-feed',
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})

export class FeedComponent implements OnInit, OnDestroy {
  @Input() set token(value: string | null) {
    if (this._token !== value) {
      this._token = value;

    }
  }
  get token(): string | null {
    return this._token;
  }
  
  private _token: string | null = null;
  posts$ = this.feedService.getPosts();
  
  constructor(private feedService: FeedService, public tokenService: TokenService) {}
  
  ngOnInit() {

  }
  
  ngOnDestroy() {
  }
  
  private async loadFeed() {
    try {
      await this.feedService.getFeed(0, 'recent', this.token);
    } catch (error) {
      console.error('Error loading feed:', error);
    }
  }
  
}