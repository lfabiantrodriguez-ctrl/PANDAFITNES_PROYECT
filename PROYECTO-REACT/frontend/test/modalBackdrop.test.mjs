import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBackdropGesture} from '../src/utils/modalBackdrop.js';
const overlay={},input={};
const event=(target,x=10,y=10,extra={})=>({target,currentTarget:overlay,clientX:x,clientY:y,pointerId:1,button:0,isPrimary:true,...extra});

test('a deliberate mouse click or touch tap on the login backdrop dismisses once',()=>{
  for(const pointerType of ['mouse','touch']) {
    const gesture=createBackdropGesture(),e=event(overlay,10,10,{pointerType});
    gesture.pointerDown(e);gesture.pointerUp(e);
    assert.equal(gesture.shouldDismiss(e),true);
    assert.equal(gesture.shouldDismiss(e),false);
  }
});

test('selecting text from an input and releasing outside never dismisses login',()=>{
  const gesture=createBackdropGesture();
  gesture.pointerDown(event(input));
  gesture.pointerMove(event(overlay,150,10));
  gesture.pointerUp(event(overlay,150,10));
  // Browsers dispatch this click on the common ancestor: the overlay.
  assert.equal(gesture.shouldDismiss(event(overlay,150,10)),false);
});

test('dragging from backdrop into dialog never dismisses login',()=>{
  const gesture=createBackdropGesture();
  gesture.pointerDown(event(overlay));gesture.pointerUp(event(input));
  assert.equal(gesture.shouldDismiss(event(overlay)),false);
});

test('scrolling or dragging on backdrop is not an outside click even if it ends at the same point',()=>{
  const gesture=createBackdropGesture();
  gesture.pointerDown(event(overlay));gesture.pointerMove(event(overlay,10,90));gesture.pointerUp(event(overlay));
  assert.equal(gesture.shouldDismiss(event(overlay)),false);
});

test('canceled touch gestures and old gestures from a closed dialog are ignored',()=>{
  const gesture=createBackdropGesture(),e=event(overlay);
  gesture.pointerDown(e);gesture.reset();gesture.pointerUp(e);
  assert.equal(gesture.shouldDismiss(e),false);
  gesture.pointerDown(e);gesture.pointerUp(e);gesture.reset();
  assert.equal(gesture.shouldDismiss(e),false);
});

test('right clicks, secondary touches and mismatched pointers cannot dismiss login',()=>{
  for(const extra of [{button:2},{isPrimary:false}]) {
    const gesture=createBackdropGesture(),e=event(overlay,10,10,extra);
    gesture.pointerDown(e);gesture.pointerUp(e);assert.equal(gesture.shouldDismiss(e),false);
  }
  const gesture=createBackdropGesture();
  gesture.pointerDown(event(overlay));gesture.pointerUp(event(overlay,10,10,{pointerId:2}));
  assert.equal(gesture.shouldDismiss(event(overlay)),false);
});

test('clicks from selecting text, keyboard actions or input interactions cannot reuse a backdrop gesture',()=>{
  const gesture=createBackdropGesture(),e=event(overlay);
  assert.equal(gesture.shouldDismiss(e),false);
  gesture.pointerDown(e);gesture.pointerUp(e);
  gesture.pointerDown(event(input));gesture.pointerUp(event(input));
  assert.equal(gesture.shouldDismiss(e),false);
});
