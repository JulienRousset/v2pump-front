import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AvatarOption } from '../../../../shared/components/edit-avatar/models/types';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  text = '{"m":[["gender","g"],["wrapperShape","w"],["background","b"],["widgets","i"],["color","c"],["borderColor","bc"],["face","f"],["ear","e"],["earrings","er"],["eyebrows","eb"],["eyes","ey"],["nose","n"],["glasses","gl"],["mouth","m"],["beard","br"],["tops","t"],["clothes","cl"],["mask","ms"],["shape","s"],["fillColor","fc"],["zIndex","z"]],"d":{"g":"male","w":"circle","b":{"c":"linear-gradient(45deg, #E3648C, #D97567)","bc":"transparent"},"i":{"f":{"s":"base","fc":"#F8D9CE","z":10},"e":{"s":"detached","z":102},"er":{"s":"hoop","z":103},"eb":{"s":"down","z":70},"ey":{"s":"smiling","z":50},"n":{"s":"round","z":60},"gl":{"s":"round","z":90},"m":{"s":"laughing","z":105},"br":{"s":"scruff","fc":"#E0DDFF","z":100},"t":{"s":"beanie","fc":"#F48150","z":80},"cl":{"s":"open","fc":"#F4D150","z":110}}}}';
  openEdit = false;
  
  // Add properties to store the data
  userData: any = null;
  tokens: any = null;
  isLoading = false;
  error: string | null = null;
  walletAddress:any = 'AdjwjWSGkp5DMAkGsUj2GeRgdV8hJzBEz4RpyY64zh1c'; // You might want to get this from user input or route params
  isNaN = isNaN;
  public level = 2;
  public currentExp = 100;

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  async ngOnInit() {
 
    this.walletAddress = this.route.snapshot.paramMap.get('id');
    if (this.walletAddress) {
      await this.fetchWalletData();
    }
  }

  /**
   * Fetches wallet data and tokens from the API
   */
  async fetchWalletData() {
    this.isLoading = true;
    this.error = null;
    
    try {
      const response: any = await this.http.post('http://127.0.0.1:3000/user/wallet', {
        walletAddress: this.walletAddress
      }).toPromise();
      
      if (response && response.status === 200) {
        this.userData = response.data.user;
        this.tokens = response.data.wallet.data;
      } else {
        this.error = response.message || 'Failed to fetch wallet data';
      }
    } catch (err: any) {
      this.error = err.message || 'An error occurred while fetching wallet data';
      console.error('Error fetching wallet data:', err);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Manually fetch wallet data with a specific address
   */
  fetchWalletDataByAddress(address: string) {
    this.walletAddress = address;
    this.fetchWalletData();
  }

  handleAvatarUpdate(updatedAvatar: AvatarOption) {
    const packed = this.packAvatar(updatedAvatar);
    this.userData.picture = JSON.stringify(packed)
  }

  handleUserUpdate(updatedUser: any) {
    this.userData.name = updatedUser.name;
    this.userData.description = updatedUser.description;
  }
  
  private packAvatar(unpacked: AvatarOption): any {
    const map: [string, string][] = [
      ['gender', 'g'],
      ['wrapperShape', 'w'],
      ['background', 'b'],
      ['widgets', 'i'],
    ];
  
    const data: any = {
      g: unpacked.gender,
      w: unpacked.wrapperShape,
      b: unpacked.background,
      i: unpacked.widgets,
    };
  
    return { m: map, d: data };
  }

  
  getExpForLevel(level: number): number {
    // Exemple simple : chaque niveau nécessite +750 XP
    return (level - 1) * 750;
  }
  
  getCurrentLevelMinExp(): number {
    return this.getExpForLevel(this.level);
  }
  
  getNextLevelMinExp(): number {
    return this.getExpForLevel(this.level + 1);
  }
  
  getProgress(): number {
    const from = this.getCurrentLevelMinExp();
    const to = this.getNextLevelMinExp();
    const gained = this.currentExp - from;
    const total = to - from;
  
    return Math.max(0, Math.min(1, gained / total));
  }
  
  getProgressPercentage(): number {
    return Math.round(this.getProgress() * 100);
  }
  
  getDisplayedExp(): number {
    return Math.max(0, this.currentExp - this.getCurrentLevelMinExp());
  }
  
  getNeededExp(): number {
    return this.getNextLevelMinExp() - this.getCurrentLevelMinExp();
  }
}
