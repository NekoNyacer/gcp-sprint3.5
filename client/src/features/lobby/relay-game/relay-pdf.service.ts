import { Service } from '@angular/core';
import { jsPDF } from 'jspdf';
import { avatarColor, avatarFace } from './relay-avatar';
import { RelayGroup, RelayPage, RelayRoom, RelayStroke } from './relay-game.models';

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;

type RelayPdfSection = {
  group: RelayGroup;
  pages: RelayPage[];
  bookIds?: string[];
  title?: string;
};

@Service()
export class RelayPdfService {
  async download(
    room: RelayRoom,
    group: RelayGroup,
    pages: RelayPage[],
    bookIds?: string[],
    title?: string,
  ): Promise<void> {
    const suffix = title ?? group.name;
    this.downloadSections(
      room,
      [{ group, pages, bookIds, title }],
      `${this.safeFileName(room.name)}-${this.safeFileName(suffix)}-畫冊.pdf`,
    );
  }

  async downloadAll(
    room: RelayRoom,
    sections: Array<Pick<RelayPdfSection, 'group' | 'pages'>>,
  ): Promise<void> {
    this.downloadSections(room, sections, `${this.safeFileName(room.name)}-全部畫冊.pdf`);
  }

  private downloadSections(room: RelayRoom, sections: RelayPdfSection[], fileName: string) {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_WIDTH;
    canvas.height = PAGE_HEIGHT;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('無法建立 PDF 畫布');

    let hasPage = false;
    for (const section of sections) {
      const sectionTitle = section.title ?? section.group.name;
      this.drawCover(context, room, section.group, sectionTitle);
      this.addCanvasPage(pdf, canvas, hasPage);
      hasPage = true;

      const books = this.booksFor(section.group, section.pages, section.bookIds);
      for (const [bookIndex, book] of books.entries()) {
        this.drawBookTitle(context, sectionTitle, bookIndex + 1, books.length, book.topic);
        this.addCanvasPage(pdf, canvas, true);

        for (const page of book.pages) {
          this.drawRelayPage(context, page, book.topic);
          this.addCanvasPage(pdf, canvas, true);
        }
      }
    }

    pdf.save(fileName);
  }

  private booksFor(group: RelayGroup, pages: RelayPage[], allowedBookIds?: string[]) {
    const bookIds = allowedBookIds ?? Object.keys(group.topicsByBook);
    return bookIds.map((bookId) => ({
      id: bookId,
      topic: group.topicsByBook[bookId] ?? group.topic,
      pages: pages
        .filter((page) => page.bookId === bookId)
        .sort((left, right) => left.pageIndex - right.pageIndex),
    }));
  }

  private drawCover(
    context: CanvasRenderingContext2D,
    room: RelayRoom,
    group: RelayGroup,
    title: string,
  ) {
    this.clearPage(context);
    context.fillStyle = '#0f7b61';
    context.fillRect(0, 0, PAGE_WIDTH, 24);
    context.fillStyle = '#e8f6ef';
    context.beginPath();
    context.arc(PAGE_WIDTH - 120, 160, 250, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#0f7b61';
    context.font = '700 42px system-ui, sans-serif';
    context.fillText('傳情畫意', 100, 170);
    context.fillStyle = '#14231f';
    context.font = '900 112px system-ui, sans-serif';
    context.fillText('傳情畫意遊戲紀念', 100, 330);

    context.fillStyle = '#0f7b61';
    context.font = '800 64px system-ui, sans-serif';
    this.drawWrappedText(context, title, 100, 470, 980, 82);

    context.fillStyle = '#44524e';
    context.font = '500 40px system-ui, sans-serif';
    context.fillText(room.name, 100, 610);

    context.fillStyle = '#f4f7f5';
    this.roundedRect(context, 82, 720, 1076, 650, 40);
    context.fill();
    context.fillStyle = '#14231f';
    context.font = '800 38px system-ui, sans-serif';
    context.fillText(room.mode === 'tabletop' ? '本局玩家' : '你的組員們', 130, 795);

    group.players.forEach((player, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 130 + column * 500;
      const y = 865 + row * 72;
      context.fillStyle = avatarColor(player.avatarSeed);
      context.beginPath();
      context.arc(x + 26, y - 13, 27, 0, Math.PI * 2);
      context.fill();
      context.font = '32px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillStyle = '#14231f';
      context.fillText(avatarFace(player.avatarSeed), x + 26, y - 2);
      context.textAlign = 'left';
      context.font = '500 34px system-ui, sans-serif';
      context.fillText(player.displayName, x + 72, y);
    });

    context.fillStyle = '#70807a';
    context.font = '400 28px system-ui, sans-serif';
    context.fillText('見證你們之間的默契有多離譜！', 100, 1600);
  }

  private drawBookTitle(
    context: CanvasRenderingContext2D,
    sectionTitle: string,
    index: number,
    total: number,
    topic: string,
  ) {
    this.clearPage(context);
    context.fillStyle = '#0f7b61';
    context.font = '800 40px system-ui, sans-serif';
    context.fillText(`${sectionTitle} · 第 ${index} / ${total} 冊`, 100, 180);
    context.fillStyle = '#14231f';
    context.font = '900 78px system-ui, sans-serif';
    context.fillText('原始題目', 100, 355);
    context.fillStyle = '#fff4c7';
    this.roundedRect(context, 80, 450, 1080, 520, 44);
    context.fill();
    context.fillStyle = '#44370d';
    context.font = '900 76px system-ui, sans-serif';
    context.textAlign = 'center';
    this.drawWrappedText(context, topic, PAGE_WIDTH / 2, 665, 900, 100, true);
    context.textAlign = 'left';
    context.fillStyle = '#70807a';
    context.font = '400 31px system-ui, sans-serif';
    context.fillText('這本畫冊最一開始的題目，看看有誰離題了！？。', 100, 1120);
  }

  private drawRelayPage(context: CanvasRenderingContext2D, page: RelayPage, topic: string) {
    this.clearPage(context);
    context.fillStyle = page.kind === 'drawing' ? '#0f7b61' : '#6a4bbc';
    context.font = '900 54px system-ui, sans-serif';
    const kind = page.kind === 'drawing' ? '作畫' : page.kind === 'guess' ? '猜詞' : '逾時跳過';
    context.fillText(`第 ${page.pageIndex + 1} 棒 · ${kind}`, 100, 150);

    context.fillStyle = avatarColor(page.playerAvatarSeed);
    context.beginPath();
    context.arc(132, 242, 42, 0, Math.PI * 2);
    context.fill();
    context.font = '48px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#14231f';
    context.fillText(avatarFace(page.playerAvatarSeed), 132, 258);
    context.textAlign = 'left';
    context.font = '700 38px system-ui, sans-serif';
    context.fillText(page.playerName, 198, 255);

    context.fillStyle = '#fffef8';
    context.strokeStyle = '#d6ddd9';
    context.lineWidth = 5;
    this.roundedRect(context, 78, 350, 1084, 1000, 34);
    context.fill();
    context.stroke();

    if (page.kind === 'skipped') {
      context.fillStyle = '#87918d';
      context.font = '800 58px system-ui, sans-serif';
      context.textAlign = 'center';
      context.fillText('⏱️ 這一棒逾時跳過', PAGE_WIDTH / 2, 850);
      context.textAlign = 'left';
    } else {
      this.drawStrokes(context, page.strokes, 110, 390, 1020, 920);
    }

    context.fillStyle = '#87918d';
    context.font = '400 26px system-ui, sans-serif';
    context.fillText(`原始題目：${topic}`, 100, 1608);
  }

  private drawStrokes(
    context: CanvasRenderingContext2D,
    strokes: RelayStroke[],
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    context.lineCap = 'round';
    context.lineJoin = 'round';
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      context.beginPath();
      context.strokeStyle = stroke.penColor || '#17201d';
      context.lineWidth = Math.max(3, Number(stroke.maxWidth ?? 4) * 2.2);
      context.moveTo(x + stroke.points[0].x * width, y + stroke.points[0].y * height);
      for (const point of stroke.points.slice(1)) {
        context.lineTo(x + point.x * width, y + point.y * height);
      }
      context.stroke();
    }
  }

  private clearPage(context: CanvasRenderingContext2D) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
  }

  private addCanvasPage(pdf: jsPDF, canvas: HTMLCanvasElement, addPage: boolean) {
    if (addPage) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  private drawWrappedText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    centered = false,
  ) {
    const lines: string[] = [];
    let current = '';
    for (const character of text) {
      const next = current + character;
      if (context.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = character;
      } else current = next;
    }
    if (current) lines.push(current);
    lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
    if (centered) context.textAlign = 'center';
  }

  private roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  }

  private safeFileName(value: string): string {
    return value.replace(/[\\/:*?"<>|]/g, '-').trim() || '傳情畫意';
  }
}
