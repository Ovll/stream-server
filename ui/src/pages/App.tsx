import { View, ElementNode } from "@lightningtv/solid";
import { useAnnouncer, useMouse } from "@lightningtv/solid/primitives";

declare global {
  interface Window {
    APP: ElementNode;
  }
}

const App = props => {
  useMouse();

  const announcer = useAnnouncer();
  announcer.debug = false;
  announcer.enabled = false;

  return (
    <View ref={window.APP}>
      <View color={0x071423ff} />
      {props.children}
    </View>
  );
};

export default App;
