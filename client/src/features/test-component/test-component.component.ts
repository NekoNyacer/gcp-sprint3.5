import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonCard,
  IonCardSubtitle,
  IonCardTitle,
  IonCardHeader,
  IonCardContent,
  IonButton,
  IonContent,
  IonInput,
} from '@ionic/angular';
import { TestService } from './test-comonent.service';
import { rxResource } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { AuthService } from '../../shared/services/auth.service';

@Component({
  selector: 'app-test-component',
  templateUrl: './test-component.component.html',
  styleUrls: ['./test-component.component.scss'],
  imports: [
    FormsModule,
    IonInput,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    JsonPipe,
  ],
})
export class TestComponentComponent {
  private readonly testService = inject(TestService);
  private readonly auth = inject(AuthService);
  inputText = signal('');
  fsMsg = rxResource({
    params: () => this.auth.user(),
    stream: () => this.testService.getMessages(),
  });

  submit() {
    this.testService.addMessage(this.inputText());
    this.inputText.set('')
  }
}
