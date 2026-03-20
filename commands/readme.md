---
description: Create or Update README.md file
agent: build
---
Your task is to create a README.md file for the current repository or update the existing README.md file found at the root of the repository.
# README Section
## Page Structure
A good `README.md` often has these sections:

- Title
- Description
- Motivation
- Quick Start
- Usage
- Contributing

## Title Section
Give the project a good name! Don't name it "project", "API server", or "test app". Give it a name that's unique and memorable. Personality is _good_. Here are some examples:

- "Text Tunnel": A terminal-based real-time messaging app
- "Steamiest": A web app that tells you which of your Steam friends has the most similar game library
- "slowviz": A library that makes it easy to visualize the network latency of a Go application

Most importantly it should:

- Pique interest
- Hint at what the project does

## Markdown Formatting
The `README.md` file should be a well-formatted [Markdown file](https://commonmark.org/help/). The title should be an `H1` (heading 1, the largest heading). Subheadings should be `H2`s and `H3`s to organize the rest of the README into a neat hierarchy.

Use rich text to make the README easy to read. Don't be shy of bold, italics, numbered lists, bullet points, and other formatting options. **Skimmability is good!**

# Description Section
The `README`'s project description should come after the title and have 1 or _maybe 2_ sentences about what The project does. State it as simply as possible. For example:

> Zipzod is a command-line tool in Go for zipping and unzipping files with an ultra low memory footprint.

> Wrapper of `rabbitmq/amqp091-go` that provides reconnection logic and sane defaults.
> 
> -- [go-rabbitmq](https://github.com/wagslane/go-rabbitmq)

> The fun, functional and stateful way to build terminal apps. A Go framework based on The Elm Architecture. Bubble Tea is well-suited for simple and complex terminal applications, either inline, full-window, or a mix of both.
> 
> -- [bubbletea](https://github.com/charmbracelet/bubbletea)

## Don't Minimize the Work
Never minimize the work with language like "just", "toy" or "test". Avoid saying things like:

- This is just a toy app
- This is just a test project
- This is for practice

## Show Don't Tell
After a short text-based description, create placeholders for either an image, GIF, live link, or video that shows the project in action!

# Motivation Section
After introducing _what_ the project is, it's time to explain _why_ it was built. Use about one paragraph to describe _why_ someone should care about the project. For example:

> There are a lot of ways to zip and unzip files, but they use so much memory! Zipzod is the zipping tool you need for working on low-memory devices like Raspberry Pis. I use a Raspberry Pi as a home server, and I was frustrated by my inability to easily manage large files on a small device, so I built zipzod.

Add placeholder for some personal flair and motivation to this section. It should cover why _it was chosen_ to build.

## Examples
[HTMX](https://github.com/bigskysoftware/htmx#motivation)

```md
- Why should only <a> and <form> be able to make HTTP requests?
- Why should only click & submit events trigger them?
- Why should only GET & POST be available?
- Why should you only be able to replace the entire screen?

By removing these arbitrary constraints htmx completes HTML as a hypertext
```

[python-websockets](https://github.com/python-websockets/websockets#why-should-i-use-websockets)

```md
The development of websockets is shaped by four principles:

- Correctness: websockets is heavily tested for compliance with RFC 6455. Continuous integration fails under 100% branch coverage.
- Simplicity: all you need to understand is msg = await ws.recv() and await ws.send(msg). websockets takes care of managing connections so you can focus on your application.
- Robustness: websockets is built for production. For example, it was the only library to handle backpressure correctly before the issue became widely known in the Python community.
- Performance: memory usage is optimized and configurable. A C extension accelerates expensive operations. It's pre-compiled for Linux, macOS and Windows and packaged in the wheel format for each system and Python version.
```

## Tell a Story
You're trying to grab attention here, and good stories do that.

> I had problem `A` and I tried `B` but it didn't work because `C`. I built `D` and now I can do `E` with ease!

# Quick Start Section
If the reader is interested enough in the "what" and the "why", now it's time to show them "how"! This section should have the _minimum number of steps_ they need to take to use the project.

Keep it _as simple as possible_! Here's an example:

````md
## 🚀 Quick Start

### 1. Install zipzod using the Go toolchain

```bash
# Install Zipzod
go install github.com/xyz/zipzod@latest

# Compress an "input" Directory Into an "output.zip" File
zipzod -i ./input -o ./output.zip
```
````

Or, if the project is a deployed web application, it might be even simpler:

```md
## 🚀 Quick Start

1. Navigate to [zipzod.xyz](https://zipzod.xyz) and upload your file!
2. Click the download link when it's done compressing!
```

# Usage Section
The "usage" section is where to show off the advanced features of the project. Think of this as the larger reference manual, or the comprehensive technical documentation. Assuming the reader has been "hooked" by the what, why, and how, this section should _wow_ them with the full capabilities of the project.

For example:

````md
## 📖 Usage

Available flags:

- `-i` - The input file or directory
- `-o` - The output file or directory
- `-v` - Verbose output
- `-h` - Show help
- `-p` - The number of parallel workers to use (default 4)
- `-d` - The maximum directory depth to recurse (default 6)
- `-f` - The file extensions to include (default .txt, .md)

## Examples

Unzip a file:

```bash
zipzod -i ./input.zip -o ./output
```

Zip with a different number of workers:

```bash
zipzod -i ./input -o ./output.zip -p 8
```
````

# Contributing Section
A "contributing" section helps the reader understand how they can contribute, or more likely in this case, how they can _build and run the project_ for local development.

If a hiring manager is _super_ interested in the project, they might want to pull it down and play with it, and you want to make that as easy as possible for them. For example:

````md
## 🤝 Contributing

### Clone the repo

```bash
git clone https://github.com/xyz/zipzod@latest
cd zipzod
```

### Build the compiled binary

```bash
go build
```

### Run the test suite

```bash
go test ./...
```

### Submit a pull request

If you'd like to contribute, please fork the repository and open a pull request to the `main` branch.
````


