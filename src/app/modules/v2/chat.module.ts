import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatRoutingModule } from './chat-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MaterialModule } from '@material/material.module';
import { SharedModule } from '@shared/shared.module';

import { HomeComponent } from './components/home/home.component';
import { ChartComponent } from './components/chart/chart.component';
import { UpdateMessageComponent } from './components/update-message/update-message.component';
import { ShortenNumberPipe } from 'src/app/shorten-number.pipe';
import { TimeAgoPipe } from 'src/app/time-ago.pipe';
import { TrendingMetaComponent } from './components/home/trendingmeta/trendingmeta.component';
import { KingOfTheHillComponent } from './components/home/kingofthehill/kingofthehill.component';
import { AdsCardComponent } from './components/home/adscard/adscard.component';
import { VirtualScrollerModule } from 'ngx-virtual-scroller';
import { TimeAgo2Pipe } from 'src/app/time-ago2.pipe';
import { NumberFormatPipe } from 'src/app/numberformat.pipe';
import { FeedComponent } from './components/chart/feed/feed.component';
import { BondingCurveComponent } from './components/chart/bonding-curve/bonding-curve.component';
import { TopHolderComponent } from './components/chart/top-holder/top-holder.component';
import { NumberAnimationDirective } from 'src/app/number-animation.directive';
import { SwapComponent } from './components/chart/swap/swap.component';
import { ChatComponent } from './components/chart/chat/chat.component';
import { ChatBanComponent } from './components/chart/chat/chat-ban/chat-ban.component';
import { ChatModeratorComponent } from './components/chart/chat/chat-moderator/chat-moderator.component';
import { LivestreamBroadcasterComponent } from './components/chart/livestream-broadcaster/livestream-broadcaster.component';
import { LivestreamViewerComponent } from './components/chart/livestream-viewer/livestream-viewer.component';
import { CameraComponent } from './components/chart/livestream-broadcaster/camera/camera.component';
import { ScreenShareComponent } from './components/chart/livestream-broadcaster/screenshare/screenshare.component';

@NgModule({
  declarations: [
    HomeComponent,
    ChartComponent,
    UpdateMessageComponent,
    TrendingMetaComponent,
    TimeAgoPipe,
    TimeAgo2Pipe,
    NumberFormatPipe,
    KingOfTheHillComponent,
    FeedComponent,
    BondingCurveComponent,
    TopHolderComponent,
    NumberAnimationDirective,
    SwapComponent,
    AdsCardComponent,
    ChatComponent,
    ChatBanComponent,
    ChatModeratorComponent,
    LivestreamBroadcasterComponent,
    LivestreamViewerComponent,
    CameraComponent,
    ScreenShareComponent
  ],
  imports: [
    SharedModule, 
    CommonModule,
    ChatRoutingModule,
    ReactiveFormsModule,
    VirtualScrollerModule,
    MaterialModule,
    FormsModule,
  ],
  exports: [
    TrendingMetaComponent,
    KingOfTheHillComponent,
    AdsCardComponent,
    
  ],
})
export class ChatModule { }
