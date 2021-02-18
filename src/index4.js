const type = (target, type) => {
  if (typeof type == "string") {
    if (typeof target != type) throw `invalidType ${target} : ${type}`;
  } else if (!(target instanceof type)) {
    throw `invalidType ${target} : ${type}`;
  }
  return target;
};

const ViewModelListener = class {
  viewmodelUpdated(updated) {
    throw "override";
  }
};

const BinderItem = class {
  el;
  viewmodel;
  constructor(
    el,
    viewmodel,
    _0 = type(el, HTMLElement),
    _1 = type(viewmodel, "string")
  ) {
    this.el = el;
    this.viewmodel = viewmodel;
    Object.freeze(this); // this 동결
    // seal과 차이점은 쓰기 가능한 속성값은 seal은 변경
  }
};

// 추상 클래스
const Visitor = class {
  visit(action, target, _0 = type(action, "function")) {
    // target 인자는 상속받는 쪽에서 오버라이드 해서 결정
    // 타 언어에서는 제네릭으로 자식에서 타입 적용가능
    throw "override";
  }
};

const DomVisitor = class extends Visitor {
  constructor() {
    super();
  }
  visit(
    action,
    target,
    _0 = type(action, "function"),
    _1 = type(target, HTMLElement)
  ) {
    // DOM 순회 코드 패턴
    const stack = [];
    let curr = target.firstElementChild;
    do {
      action(curr);
      if (curr.firstElementChild) stack.push(curr.firstElementChild);
      if (curr.nextElementSibling) stack.push(curr.nextElementSibling);
    } while ((curr = stack.pop()));
  }
};

// Scanner의 추상 클래스
const Scanner = class {
  #visitor; // 같은 계층의 visitor
  // 같은 수준 맞추기 위해 네이티브 지식이 없어야한다
  constructor(visitor, _ = type(visitor, DomVisitor)) {
    this.#visitor = visitor;
  }
  // 자식이 부모에 접근하기 위해서 한번더 감싼 visit 메서드 만들어서 위임
  visit(action, target) {
    this.#visitor.visit(action, target);
  }

  // override 하기위한 함수
  // 지저분한 로직은 안쓰고 계층을 맞춘다
  scan(target) {
    throw "override";
  }
};

const DomScanner = class extends Scanner {
  constructor(visitor, _ = type(visitor, DomVisitor)) {
    super(visitor); // 자식이 부모를 대체
  }

  scan(target, _ = type(target, HTMLElement)) {
    const binder = new Binder();
    const action = (el) => {
      const vm = el.getAttribute("data-viewmodel");
      if (vm) binder.add(new BinderItem(el, vm));
    };
    action(target);
    this.visit(action, target); // 이제 계층 일치
    return binder;
  }
};

const Binder = class extends ViewModelListener {
  #items = new Set();
  #processors = {};

  add(item, _ = type(item, BinderItem)) {
    // 스캐너가 이걸로 넣어줄거야
    this.#items.add(item);
  }

  addProcessor(p, _0 = type(p, Processor)) {
    // 계약
    this.#processors[p.category] = p;
  }

  render(viewmodel, _ = type(viewmodel, ViewModel)) {
    const processors = Object.entries(this.#processors);
    this.#items.forEach((item) => {
      const vm = type(viewmodel[item.viewmodel], ViewModel);
      const el = item.el;

      processors.forEach(([pKey, processor]) => {
        // if (vm[pKey]) {
        Object.entries(vm[pKey]).forEach(([key, value]) => {
          processor.process(vm, el, key, value);
        });
        // }
      });
    });
  }
  // 특정 뷰모델에 옵저버가 될건지 안될건지
  watch(viewmodel, _ = type(viewmodel, ViewModel)) {
    viewmodel.addListener(this);
    this.render(viewmodel);
  }
  unwatch(viewmodel, _ = type(viewmodel, ViewModel)) {
    viewmodel.removeListener(this);
  }

  viewmodelUpdated(updated) {
    const items = {};
    this.#items.forEach((item) => {
      items[item.viewmodel] = [
        type(rootViewModel[item.viewmodel], ViewModel),
        item.el
      ];
    });
    updated.forEach(({ subKey, category, key, value }) => {
      console.log(subKey, category, key, value);
      if (!items[subKey]) return;
      const [vm, el] = items[subKey];
      const processor = this.#processors[category];
      // injection 이 안 되어 있을 경우  return
      if (!el || !processor) return;
      processor.process(vm, el, key, value);
    });
  }
};

// Binder의 Strategy가 될 Class
const Processor = class {
  category;
  constructor(category) {
    this.category = category;
    Object.freeze(this);
  }

  // template method
  process(
    vm,
    el,
    key,
    value,
    _0 = type(vm, ViewModel),
    _1 = type(el, HTMLElement),
    _2 = type(key, "string")
  ) {
    this._process(vm, el, key, value);
  }

  // hook method
  _process(vm, el, k, v) {
    throw "override";
  }
};

// Info객체
const ViewModelValue = class {
  subKey;
  category;
  key;
  value;
  constructor(subKey, category, key, value) {
    this.subKey = subKey;
    this.category = category;
    this.key = key;
    this.value = value;
    Object.freeze(this);
  }
};

const ViewModelSubject = class extends ViewModelListener {
  #info = new Set();
  #listeners = new Set();

  add(value, _ = type(value, ViewModelValue)) {
    this.#info.add(value);
  }
  clear() {
    this.#info.clear();
  }

  addListener(listener, _ = type(listener, ViewModelListener)) {
    this.#listeners.add(listener);
    ViewModelSubject.watch(this);
  }
  removeListener(listener, _ = type(listener, ViewModelListener)) {
    this.#listeners.delete(listener);
    if (!this.#listeners.size) ViewModelSubject.unwatch(this);
  }
  notify() {
    this.#listeners.forEach((listener) =>
      listener.viewmodelUpdated(this.#info)
    );
  }

  static #subjects = new Set();
  static #inited = false;
  static notify() {
    const f = () => {
      this.#subjects.forEach((vm) => {
        if (vm.#info.size) {
          vm.notify();
          vm.clear();
        }
      });
      if (this.#inited) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  // 리스너에 등록된 뷰모델이 있어야 시작
  static watch(vm, _ = type(vm, ViewModelListener)) {
    this.#subjects.add(vm);
    if (!this.#inited) {
      this.#inited = true; // 감시 시작
      this.notify();
    }
  }

  static unwatch(vm, _ = type(vm, ViewModelListener)) {
    this.#subjects.delete(vm);
    if (!this.#subjects.size) this.#inited = false; // 감시 끄기
  }
};

const ViewModel = class extends ViewModelSubject {
  static get(data) {
    return new ViewModel(data);
  }

  styles = {};
  attributes = {};
  properties = {};
  events = {};

  // public getter private setter 패턴
  // 외부에서는 읽기전용만 가능 readonly
  #subKey = "";
  get subKey() {
    return this.#subKey;
  }

  #parent = null;
  get parent() {
    return this.#parent;
  }
  setParent(parent, subKey) {
    // 애도 사실 private인데 JS에서는 표현할 방법이없다
    // 내부 사용 메서드는 되도록 _name으로 붙여주도록 하자
    this.#parent = type(parent, ViewModel);

    // 아래는 부모 설정과 함께 한번에 일어나는 일들 parent가 들어오면 같이 로직이 동작해야한다
    // transaction 연산임을 알려야한다 -> 함수로 만들기
    // 보통 복붙으로 코드를 많이쓰는데 빼먹는 코드들이 많다
    // transaction을 통째로 이렇게 함수로 만들어야지 빼먹지 않고 만든다
    this.#subKey = subKey;
    this.addListener(parent);
  }

  static descriptor = (vm, category, k, v) => ({
    enumerable: true,
    get: () => v,
    set: (newV) => {
      v = newV;
      // vm.#isUpdated.add(new ViewModelValue(vm.subKey, category, k, v));
      // 상속받은 매서드로 subject 클래스에서 실행
      vm.add(new ViewModelValue(vm.subKey, category, k, v));
    }
  });

  static defineProperties = (vm, category, obj) =>
    Object.defineProperties(
      obj,
      Object.entries(obj).reduce(
        (r, [k, v]) => ((r[k] = ViewModel.descriptor(vm, category, k, v)), r),
        {}
      )
    );

  constructor(data, _ = type(data, "object")) {
    super();
    Object.entries(data).forEach(([key, value]) => {
      if ("styles,attributes,properties".includes(key)) {
        this[key] = ViewModel.defineProperties(this, key, value);
      } else {
        Object.defineProperty(
          this,
          key,
          ViewModel.descriptor(this, "", key, value)
        );
        if (value instanceof ViewModel) {
          // value.parent = this;
          // value.subKey = key;
          // value.addListener(this);

          // transaciton 함수로 묶어서 동작
          value.setParent(this, key);
        }
      }
    });
    // ViewModel.notify(this); 뷰모델 서브젝트가 알아서 할일
    Object.seal(this);
  }

  viewmodelUpdated(update) {
    // update.forEach((value) => this.#isUpdated.add(value));
    // ViewModelSubject의 add로 통해서 동작
    update.forEach((value) => this.add(value));
  }
};

// 실행
const scanner = new DomScanner(new DomVisitor());
const binder = scanner.scan(document.querySelector("#target"));
binder.addProcessor(
  new (class extends Processor {
    _process(vm, el, k, v) {
      el.style[k] = v;
    }
  })("styles")
);
binder.addProcessor(
  new (class extends Processor {
    _process(vm, el, k, v) {
      el.setAttribute(k, v);
    }
  })("attributes")
);
binder.addProcessor(
  new (class extends Processor {
    _process(vm, el, k, v) {
      el[k] = v;
    }
  })("properties")
);
binder.addProcessor(
  new (class extends Processor {
    _process(vm, el, k, v) {
      el[`on${k}`] = (e) => v.call(el, e, vm);
    }
  })("events")
);

const getRandom = () => parseInt(Math.random() * 150) + 100;
const wrapper = ViewModel.get({
  styles: { width: "50%", background: "#ffa", cursor: "pointer" },
  events: {
    click(e, vm) {
      vm.parent.isStop = true;
    }
  }
});
const title = ViewModel.get({ properties: { innerHTML: "Title" } });
const contents = ViewModel.get({ properties: { innerHTML: "Contents" } });
const rootViewModel = ViewModel.get({
  isStop: false,
  changeContents() {
    this.wrapper.styles.background = `rgb(${getRandom()},${getRandom()},${getRandom()})`;
    this.contents.properties.innerHTML = Math.random()
      .toString(16)
      .replace(".", "");
  },
  wrapper,
  title,
  contents
});
binder.watch(rootViewModel);
const f = () => {
  rootViewModel.changeContents();
  // if (!rootViewModel.isStop) setTimeout(f, 5000)
};
setTimeout(f, 5000);
