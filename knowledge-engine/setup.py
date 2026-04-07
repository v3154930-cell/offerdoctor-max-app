from setuptools import setup, find_packages

setup(
    name="knowledge-engine",
    version="1.0.0",
    packages=find_packages(),
    install_requires=[
        "fastapi>=0.115.0",
        "uvicorn>=0.30.0",
        "sqlalchemy>=2.0.35",
        "sentence-transformers>=3.0.0",
        "numpy>=1.26.0",
        "requests>=2.32.0",
        "python-dotenv>=1.0.0",
        "streamlit>=1.35.0",
        "pandas>=2.2.0",
        "python-multipart>=0.0.9",
    ],
    entry_points={
        "console_scripts": [
            "ke-server=run:main",
        ],
    },
    author="Your Name",
    description="Universal Knowledge Engine for bots and AI agents",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/knowledge-engine",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.11",
)