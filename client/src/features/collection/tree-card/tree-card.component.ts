import { Component, input } from '@angular/core';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
} from '@ionic/angular';

@Component({
  selector: 'app-tree-card',
  templateUrl: './tree-card.component.html',
  imports: [IonCardContent, IonCardSubtitle, IonCardTitle, IonCardHeader, IonCard],
})
export class TreeCardComponent {
  tree = input.required<Tree>();
}

export type Tree = {
  name: string;
  location: Location;
  growthLevel: '1' | '2' | '3' | '4' | '5';
};

export type CityDistrictMap = {
  台北市: '內湖區' | '南港區';
  新北市: '板橋區';
  基隆市: '金山區';
  桃園市: '林口區';
};

export type Location = {
  [City in keyof CityDistrictMap]: `${City}${CityDistrictMap[City]}`;
}[keyof CityDistrictMap];
