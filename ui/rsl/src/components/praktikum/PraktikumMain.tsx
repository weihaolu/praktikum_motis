
import { useState } from "react";
import { Outlet } from "react-router-dom";
// import { getMockedRoundtrips } from "./MockedRoundtripsGenerator";

import RoundtripSidebar from "./Sidebar";

function Praktikum(): JSX.Element {
  const [progress, setProgress] = useState(-1);

  // const time = new Date("Tue Sep 24 2019 02:00:00 GMT+0100");
  // getMockedRoundtrips("8000261", Math.round(time.getTime() / 1000)).then((result) => {
  //   console.log(result);
  // });

  return (
    <>
      <div className="bg-db-cool-gray-200 dark:bg-gray-800 w-[25rem] overflow-y-auto p-2 shrink-0">
        <RoundtripSidebar progress={progress} setProgress={setProgress} />
      </div>
      <div className="overflow-y-auto grow p-2">
        <Outlet context={[setProgress]} />
      </div>
    </>
  );
}

export default Praktikum;