enum ASSET_TYPE {
  AUDIO,
  IMAGE,
}
interface State {
  inventory?: boolean;
  setting?: boolean;
  gameover?: boolean;
  line: number;
  cursor: number;
  propmt: number;
  chapter: number;
  scene: number;
  sentence: number;
}
interface Choice {
  question: Sentence;
  answer: string[];
}
interface Charactor {
  name: string;
  images: {
    [Key: string]: string;
  };
}
interface Sentence {
  word: string;
  promptSpeed?: number;
  audio?: string;
}
// type Prompt = (Sentence[] | Charactor | Choice)[];
// interface Prompt {
//   charactor: Charactor;
//   sentence: (Sentence | Choice)[];
// }
interface Prompt {
  charactor: Charactor;
  sentence: Sentence[];
  choice?: Choice;
}
// interface Prompt {
//   sentence: Sentence[];
//   charactor: Charactor;
//   choice?: Choice;
// }
interface Background {
  image?: string;
  position?: string;
  color?: string;
}
interface Scene {
  prompt: Prompt[];
  save?: boolean;
  background: Background;
}
interface Assets {
  type: ASSET_TYPE;
  url: string;
  preLoading?: number;
}
interface Id<T> {
  [id: string]: T;
}
interface Chapter {
  scene: Scene[];
  assets: Assets[];
}
class Canvas {
  protected pause = false;
  protected freese = false;
  protected width = 0;
  protected height = 0;
  #canvas = document.getElementById("visual-novel") as HTMLCanvasElement;
  protected context = this.#canvas.getContext("2d");
  constructor() {
    this.resizing(800, 600);
  }

  protected startFrame() {
    if (!this.freese) this.draw();
    requestAnimationFrame(() => this.startFrame());
  }
  protected resizing(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.#canvas.width = this.width;
    this.#canvas.height = this.height;
  }
  draw() {
    this.context.clearRect(0, 0, this.width, this.height);
  }
}
// class Dom {
//   width = 0;
//   height = 0;
//   context = document.getElementById("visual-novel") as HTMLDivElement;
//   constructor() {
//     this.resizing(800, 600);
//     // this.context.strokeRect(50, 50, 50, 50);
//   }
//   protected resizing(width: number, height: number) {
//     this.width = width;
//     this.height = height;
//     this.context.setAttribute(
//       "style",
//       `width: ${this.width}px; height: ${this.height}px;`
//     );
//   }
// }
class Game extends Canvas {
  // class Game extends Dom {
  readonly promptSpeed = 1 / 5;
  protected chapter: Chapter[];
  protected assets: Id<Assets[]>;
  protected state: State;

  constructor(chapter: Chapter[]) {
    super();
    this.onLoad();
    this.chapter = chapter;
    this.assets = Array(this.chapter.length)
      .fill(null)
      .reduce((a, _, i) => {
        const v = this.chapter[i].assets.reduce(
          (a, v) => ({
            ...a,
            [v.url]: v,
          }),
          {}
        );
        return { ...a, ...v };
      }, {});
    addEventListener("keypress", this.addEventListener.bind(this));
    this.startFrame();

    // this.assets = [{url}]
  }

  onSave() {}
  onLoad() {
    this.state = {
      chapter: 0,
      scene: 0,
      propmt: 0,
      sentence: 0,
      line: 0,
      cursor: 0,
    };
  }
  addEventListener(e: KeyboardEvent) {
    switch (e.key) {
      case "i":
        this.pause = !this.pause;
        this.state.inventory = !this.state.inventory;
        break;
      case "Enter":
        if (this.state.line >= this.isSentence.length) {
          this.state.propmt += 1;
          this.state.cursor = 0;
          this.state.line = 0;
        } else {
          this.state.line += 1;
        }
        // this.state.promptSpeed = [0];
        break;
    }
  }

  chapterLoading() {}

  render() {}

  drawInventory() {
    if (this.state?.inventory) {
      this.context.fillStyle = "black";
      this.context.fillRect(0, 0, this.width, this.height);
    }
  }

  get isSentence() {
    return this.chapter[this.state.chapter].scene[this.state.scene].prompt[
      this.state.propmt
    ].sentence;
  }
  drawScene() {
    // const width = 600;
    // const height = 200;
    // const promptSpeed = this.isSentence.promptSpeed || this.promptSpeed;
    // this.context.fillStyle = "black";
    // this.context.fillRect(0, this.height - height, this.width, height);
    // this.context.font = "48px serif";
    // this.context.fillStyle = "white";
    // for (const _index in this.state.promptSpeed) {
    //   const index = +_index;
    //   const startIndex = this.state.promptSpeed[index - 1] || 0;
    //   const endIndex = this.state.promptSpeed[index];
    //   const word = this.isSentence.word.substring(startIndex, endIndex);
    //   this.context.fillText(
    //     word,
    //     (this.width - width) / 2,
    //     this.height - height + 100 + index * 50,
    //     width
    //   );
    //   if (index === this.state.promptSpeed.length - 1) {
    //     if (this.state.promptSpeed[index] > this.isSentence.word.length) {
    //       break;
    //     }
    //     const nextWord = this.isSentence.word.substring(
    //       startIndex,
    //       endIndex + promptSpeed
    //     );
    //     if (this.context.measureText(nextWord).width > width) {
    //       this.state.promptSpeed.push(this.state.promptSpeed[index]);
    //       // console.log("dawdawdawdawdawd");
    //     } else {
    //       this.state.promptSpeed[index] += promptSpeed;
    //     }
    //   }
    // }
  }

  drawPrompt() {
    const width = 600;
    const height = 200;

    this.context.fillStyle = "black";
    this.context.fillRect(0, this.height - height, this.width, height);
    this.context.font = "48px serif";
    this.context.fillStyle = "white";
    for (const _index in this.isSentence) {
      const index = +_index;
      const promptSpeed =
        this.isSentence[index].promptSpeed || this.promptSpeed;
      let word = this.isSentence[index].word;

      if (this.state.line < index) break;
      if (this.state.line === index) {
        word = word.substring(0, this.state.cursor);
      }
      this.state.cursor += promptSpeed;
      this.context.fillText(
        word,
        (this.width - width) / 2,
        this.height - height + 100 + index * 50,
        width
      );
      if (word === this.isSentence[index].word && this.state.line <= index) {
        this.state.line += 1;
        this.state.cursor = 0;
      }
      // const startIndex = this.state.line < index
      // const endIndex = this.state.promptSpeed;
      // const word = this.isSentence.word.substring(startIndex, endIndex);
      // this.context.fillText(
      //   word,
      //   (this.width - width) / 2,
      //   this.height - height + 100 + index * 50,
      //   width
      // );
      // // console.log(this.isSentence.word[index], index);
      // // console.log("=============");
      // // console.log(word);
      // if (index === this.state.promptSpeed.length - 1) {
      //   if (word === this.isSentence.word[index]) {
      //     if (this.isSentence.word.length > this.state.promptSpeed.length) {
      //       this.state.promptSpeed.push(0);
      //     }
      //   } else {
      //     this.state.promptSpeed[index] += promptSpeed;
      //   }
      // }

      // if (index === this.state.promptSpeed.length - 1) {
      //   if (this.state.promptSpeed[index] > this.isSentence.word.length) {
      //     break;
      //   }
      //   const nextWord = this.isSentence.word[index].substring(
      //     startIndex,
      //     endIndex + promptSpeed
      //   );
      //   if (this.context.measureText(nextWord).width > width) {
      //     this.state.promptSpeed.push(0);
      //     // console.log("dawdawdawdawdawd");
      //   } else {
      //     this.state.promptSpeed[index] += promptSpeed;
      //   }
      // }
    }
  }

  draw() {
    super.draw();
    if (!this.pause) {
      this.drawScene();
      this.drawPrompt();
    }
    this.drawInventory();
  }
}
const dd = new Game([
  {
    scene: [
      {
        prompt: [
          {
            charactor: {
              name: "matthew",
              images: {},
            },
            sentence: [
              {
                word: "안녕하세요",
              },
              {
                word: "반가워요",
              },
            ],
          },
          {
            charactor: {
              name: "matthew",
              images: {},
            },
            sentence: [
              {
                word: "안녕하세요",
              },
              {
                word: "반가워요",
              },
            ],
          },
        ],
        background: {
          image: "assets/shutterstock_376532611.jpeg",
        },
      },
    ],
    assets: [
      {
        type: ASSET_TYPE.IMAGE,
        url: "assets/shutterstock_376532611.jpeg",
      },
    ],
  },
  {
    scene: [],
    assets: [
      {
        type: ASSET_TYPE.IMAGE,
        url: "assets/sunset-1373171__480.jpeg",
      },
    ],
  },
]);
