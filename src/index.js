const ViewModel = class {
  static #private = Symbol();

  static get(data) {
    // static으로 ViewModel.get() 으로만 뷰모델 생성 가능
    return new ViewModel(this.#private, data);
  }

  styles = {};
  attribute = {};
  properties = {};
  events = {};

  constructor(checker, data) {
    if (checker != ViewModel.#private) throw "use ViewModel.get() !!";
    // 외부에서는 생성 불가능하도록
    Object.entries(data).forEach(([key, value]) => {
      switch (key) {
        case "styles":
          this.styles = value;
          break;
        case "attribute":
          this.attribute = value;
          break;
        case "properties":
          this.properties = value;
          break;
        case "events":
          this.events = value;
          break;
        default:
          this[key] = value;
      }
    });
    Object.seal(this); // 더이상 키 추가 불가
  }
};
