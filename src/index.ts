enum ASSET_TYPE {
  AUDIO,
  IMAGE,
}
interface State {
  interface?: boolean;
  setting?: boolean;
  gameover?: boolean;
  wordStep: number[];
  chapter: number;
  scene: number;
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
  wait?: number;
  wordStep?: number;
  audio?: string;
  enter?: boolean;
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
  protected width = 0;
  protected height = 0;
  #canvas = document.getElementById("visual-novel") as HTMLCanvasElement;
  protected context = this.#canvas.getContext("2d");
  constructor() {
    this.resizing(800, 600);
  }

  protected requestAnimationFrame() {
    this.draw();
    // this.requestAnimationFrame();
    requestAnimationFrame(this.requestAnimationFrame.bind(this));
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
  readonly wordStep = 1 / 5;
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
    this.requestAnimationFrame();

    // this.assets = [{url}]
  }

  onSave() {}
  onLoad() {
    this.state = {
      chapter: 0,
      scene: 0,
      wordStep: [0],
    };
  }
  addEventListener(e: KeyboardEvent) {
    switch (e.key) {
      case "i":
        this.state.interface = !this.state.interface;
        break;
    }
  }

  chapterLoading() {}

  render() {}

  interface() {
    if (this.state?.interface) {
      this.context.fillStyle = "black";
      this.context.fillRect(0, 0, this.width, this.height);
    }
  }
  scene() {
    const width = 600;
    const height = 200;
    const word = this.chapter[0].scene[0].prompt[0].sentence[0].word;
    const wordStep =
      this.chapter[0].scene[0].prompt[0].sentence[0].wordStep || this.wordStep;
    this.context.fillStyle = "black";
    this.context.fillRect(0, this.height - height, this.width, height);
    this.context.font = "48px serif";
    this.context.fillStyle = "white";
    for (const _index in this.state.wordStep) {
      const index = +_index;
      const startIndex = this.state.wordStep[index - 1] || 0;
      const endIndex = this.state.wordStep[index];
      // if (index > 2) break;
      this.context.fillText(
        word.substring(startIndex, endIndex),
        (this.width - width) / 2,
        this.height - height + 100 + index * 50,
        width
      );
      // this.state.wordStep[+index] += wordStep;
      if (index === this.state.wordStep.length - 1)
        if (
          this.context.measureText(
            word.substring(startIndex, endIndex + wordStep)
          ).width > width
        ) {
          this.state.wordStep.push(this.state.wordStep[+index]);
        } else {
          this.state.wordStep[+index] += wordStep;
        }
    }
    // if (
    //   this.context.measureText(word.substring(0, this.isWordStep)).width > width
    // ) {
    // }
    // while (line <= this.isWordLine) {
    //   if (
    //     this.context.measureText(word.substring(0, this.isWordStep)).width >
    //     width
    //   ) {
    //     this.isWordLine = 1;
    //   }
    //   this.context.fillText(
    //     word.substring(0, this.isWordStep),
    //     (this.width - width) / 2,
    //     this.height - height + 100 + line * 50,
    //     width
    //   );
    // }
  }

  draw() {
    super.draw();
    // console.log("djlakwdaw", this);
    this.scene();
    this.interface();
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
              { word: "테스트세트스으 rkske 가나다 간다ㅏ... 아저앚마앚" },
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
