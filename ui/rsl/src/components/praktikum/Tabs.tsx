import { ReactNode, useState } from "react";

export interface Tab {
    label: string;
    content: ReactNode;
}

interface TabsProp {
    tabs: Tab[];
    activeTab?: number
}

export const Tabs: React.FC<TabsProp> = ({ tabs, activeTab }) => {
    const [activeTabIndex, setActiveTabIndex] = useState(activeTab || 0);

    const handleTabClick = (index: number) => {
        setActiveTabIndex(index);
    };

    return (
        <div>
            <div className="tab-row">
                {tabs.map((tab, index) => (
                    <button
                        key={index}
                        onClick={() => handleTabClick(index)}
                        className={index === activeTabIndex ? "active" : ""}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="tab-content">{tabs[activeTabIndex].content}</div>
        </div>
    );
};
