// A drag from the dialog to the overlay can produce a click on their common
// ancestor. Only a complete, stationary gesture on the backdrop may dismiss it.
export function createBackdropGesture() {
  let gesture=null;
  const onBackdrop=event=>event.target===event.currentTarget;
  const moved=event=>Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>5;
  return {
    reset(){gesture=null;},
    pointerDown(event){
      gesture={id:event.pointerId,x:event.clientX,y:event.clientY,
        eligible:onBackdrop(event)&&event.button===0&&event.isPrimary!==false,moved:false,completed:false};
    },
    pointerMove(event){
      if(gesture&&event.pointerId===gesture.id&&moved(event))gesture.moved=true;
    },
    pointerUp(event){
      if(!gesture)return;
      gesture.completed=event.pointerId===gesture.id&&gesture.eligible&&!gesture.moved&&!moved(event)&&onBackdrop(event);
    },
    shouldDismiss(event){
      const completed=Boolean(gesture?.completed&&onBackdrop(event));
      gesture=null;
      return completed;
    },
  };
}
