import { useState } from 'react';
import { Link } from 'react-router-dom';

type FileContent = { name: string, content: any };

function RoundtripOutline(): JSX.Element {
    const [fileContent, setFileContent] = useState<FileContent | null>(null);
    const [value, setValue] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>): void {
        const file = e.target.files?.[0];
        if (file && file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const content = JSON.parse(reader.result as string) as FileContent;
                    setFileContent({ name: file.name, content });
                    setErrorMessage(null);
                } catch (error) {
                    setErrorMessage('Invalid JSON format');
                }
            };
            reader.readAsText(file);
        } else {
            setErrorMessage('Invalid file type');
        }
    }

    function handleDrop(e: React.DragEvent<HTMLDivElement>): void {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const content = JSON.parse(reader.result as string) as FileContent;
                    setFileContent({ name: file.name, content });
                    setErrorMessage(null);
                } catch (error) {
                    setErrorMessage('Invalid JSON format');
                }
            };
            reader.readAsText(file);
        } else {
            setErrorMessage('Invalid file type');
        }
    }

    function handleDragOver(e: React.DragEvent<HTMLDivElement>): void {
        e.preventDefault();
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
        const newValue = parseInt(e.target.value, 10);
        if (!isNaN(newValue)) {
            setValue(newValue);
        } else {
            setValue(null);
        }
    }

    return (
        <div>
            <label>
                Umläufe:
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={(e) => e.stopPropagation()}
                    style={{ border: '1px solid black', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}
                >
                    {fileContent ? (
                        <pre>"{fileContent.name}" uploaded</pre>
                    ) : (
                        <>
                            <p>Drag and drop a JSON file here or click to select a file</p>
                            <input type="file" onChange={handleFileSelect} style={{ display: 'none' }}
                                className="block w-full text-sm rounded-md bg-white dark:bg-gray-700 border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                            />
                            <button onClick={() => (document.querySelector('input[type=file]') as HTMLInputElement)?.click()}></button>
                        </>
                    )}
                    {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
                </div>
            </label>
            <label>
                Anzahl an Umläufen, die nicht bedient werden können:
                <div>
                    <input type="number" value={value ?? ''} onChange={handleInputChange}
                        className="block w-full text-sm rounded-md bg-white dark:bg-gray-700 border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                </div>
                {value !== null && fileContent !== null && (
                    <Link
                        to={`/praktikum/${encodeURIComponent(JSON.stringify({ roundTrips: fileContent.content, cancelRoundTrips: value }))}`}>
                        <button className="inline-flex items-baseline px-3 py-1 rounded text-sm bg-db-red-500 hover:bg-db-red-600 text-white">Berechne</button>
                    </Link>
                )}
            </label>
        </div>
    );
}


export default RoundtripOutline;