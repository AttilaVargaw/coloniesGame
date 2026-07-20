export function DataWindow({ data, header }: { data?: Record<string, unknown>, header?: string }) {
    return data &&
        <div style={{
            position: "absolute", bottom: 0, left: 0, zIndex: 1000, background: "white", padding: 10,
            minWidth: 400
        }}>
            <div>{header}</div>
            {Object.keys(data).map((key) =>
                <div key={key}>{key}: {String(data[key])}</div>)
            }
        </div>
}
